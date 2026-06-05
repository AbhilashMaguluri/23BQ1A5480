# Notification System Design

A design document for a campus notification platform (events, results, placements). Backend stack assumed: Node.js + Express, PostgreSQL, Redis, and a message queue.

---

# Stage 1

**What this asks:** Design the REST API a frontend developer can build against, plus two real-time delivery mechanisms.

## Core actions
- Send a notification to a student (created by admin or by the system).
- List a student's notifications (with filters like unread-only and type).
- Read a single notification.
- Mark a notification as read, or mark all as read.
- Get the unread count (for the bell badge).

## Endpoints

### 1. Create / send a notification (admin)
- **Endpoint:** `POST /notifications`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request:**
```json
{
  "studentId": 1042,
  "type": "Placement",
  "title": "Placement Drive: Infosys",
  "body": "Infosys is visiting on 12 June. Register by 10 June."
}
```
- **Response (201):**
```json
{
  "id": 9001,
  "studentId": 1042,
  "type": "Placement",
  "title": "Placement Drive: Infosys",
  "body": "Infosys is visiting on 12 June. Register by 10 June.",
  "isRead": false,
  "createdAt": "2026-06-05T10:00:00Z"
}
```

### 2. List a student's notifications
- **Endpoint:** `GET /students/{studentId}/notifications?isRead=false&type=Placement&page=1&limit=20`
- **Headers:** `Authorization: Bearer <token>`
- **Request:** none (query params only)
- **Response (200):**
```json
{
  "page": 1,
  "limit": 20,
  "total": 3,
  "items": [
    {
      "id": 9001,
      "type": "Placement",
      "title": "Placement Drive: Infosys",
      "isRead": false,
      "createdAt": "2026-06-05T10:00:00Z"
    }
  ]
}
```

### 3. Get one notification
- **Endpoint:** `GET /notifications/{id}`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):** a single notification object (same shape as above).

### 4. Mark one notification as read
- **Endpoint:** `PATCH /notifications/{id}/read`
- **Headers:** `Authorization: Bearer <token>`
- **Request:** none
- **Response (200):**
```json
{ "id": 9001, "isRead": true, "readAt": "2026-06-05T10:05:00Z" }
```

### 5. Mark all as read
- **Endpoint:** `PATCH /students/{studentId}/notifications/read-all`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{ "studentId": 1042, "updatedCount": 12 }
```

### 6. Unread count (for the badge)
- **Endpoint:** `GET /students/{studentId}/notifications/unread-count`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200):**
```json
{ "studentId": 1042, "unreadCount": 5 }
```

## Naming conventions
- Plural nouns for collections (`/notifications`, `/students`).
- Nested path for ownership (`/students/{id}/notifications`).
- HTTP methods carry the action: `GET` read, `POST` create, `PATCH` partial update.

## Two real-time notification mechanisms
1. **WebSocket (Socket.IO):** the browser opens a persistent two-way connection. When a notification is created, the server pushes it instantly to that student's socket. Good for live, interactive UIs.
2. **Server-Sent Events (SSE):** the browser opens one long-lived HTTP connection and the server streams events one way (server -> client). Simpler than WebSocket and enough for notifications, which only flow outward.

---

# Stage 2

**What this asks:** Pick persistent storage, justify it, design the schema, list scaling problems with solutions, and write the queries behind Stage 1.

## Database choice: PostgreSQL (relational)
**Why it is suitable:**
- The data is structured and related (students own notifications) — a perfect fit for tables and foreign keys.
- We filter and sort a lot (by `studentId`, `isRead`, `type`, `createdAt`) — relational indexes handle this well.
- Read/unread state needs reliable updates — Postgres gives ACID transactions.
- It supports an `ENUM` type for `notificationType`, keeping data clean.

## Schema
```sql
CREATE TABLE students (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  email     VARCHAR(160) NOT NULL UNIQUE
);

CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  studentId  INTEGER NOT NULL REFERENCES students(id),
  type       notification_type NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  isRead     BOOLEAN NOT NULL DEFAULT false,
  createdAt  TIMESTAMP NOT NULL DEFAULT now(),
  readAt     TIMESTAMP
);
```

## Queries behind the Stage 1 APIs
```sql
-- Create a notification (API 1)
INSERT INTO notifications (studentId, type, title, body)
VALUES (1042, 'Placement', 'Placement Drive: Infosys', 'Register by 10 June')
RETURNING *;

-- List notifications, unread first page (API 2)
SELECT id, type, title, isRead, createdAt
FROM notifications
WHERE studentId = 1042 AND isRead = false
ORDER BY createdAt DESC
LIMIT 20 OFFSET 0;

-- Mark one as read (API 4)
UPDATE notifications
SET isRead = true, readAt = now()
WHERE id = 9001;

-- Mark all as read (API 5)
UPDATE notifications
SET isRead = true, readAt = now()
WHERE studentId = 1042 AND isRead = false;

-- Unread count (API 6)
SELECT COUNT(*) AS unreadCount
FROM notifications
WHERE studentId = 1042 AND isRead = false;
```

## Scaling problems as data grows, and solutions
| Problem | Solution |
|---|---|
| Table grows to millions of rows; queries slow | Add indexes (see Stage 3); paginate results |
| Broadcasts create huge write bursts (one row per student) | Batch inserts; process via a queue (Stage 5) |
| Old notifications pile up forever | Archive or delete notifications older than N months |
| Read traffic spikes on page loads | Cache + read replicas (Stage 4) |
| One giant table is hard to manage | Partition `notifications` by month on `createdAt` |

---

# Stage 3

**What this asks:** Analyze a given query for correctness and speed, propose indexes, judge "index everything," and write a Placement query.

```sql
SELECT * FROM notifications
WHERE studentId = 1042
AND isRead = false
ORDER BY createdAt DESC;
```

## 1. Is the query accurate?
Yes. It correctly returns the unread notifications for student 1042, newest first. The logic is right.

## 2. Why is it slow?
- **No matching index** -> the database does a **full table scan**, reading every row to find this student's unread ones. This gets worse as the table grows.
- **`SELECT *`** fetches every column (including the large `body`), moving more data than the UI needs.
- **Sorting** is done on all matching rows at query time, with no index to provide the order.

## 3. What changes should be made?
- Add a composite index that matches the filter **and** the sort.
- Select only needed columns instead of `*`.
- Add `LIMIT`/pagination so we never sort or return the whole history.

## 4. What indexes should be created?
```sql
CREATE INDEX idx_notifications_student_unread_created
ON notifications (studentId, isRead, createdAt DESC);
```
This index matches the `WHERE studentId = ? AND isRead = ?` filter and already stores rows in `createdAt DESC` order, so both the lookup and the sort are served by the index.

## 5. Likely computation cost improvement
- **Before:** `O(N)` — scan and sort the whole table (e.g. millions of rows).
- **After:** roughly `O(log N + k)` — jump straight to this student's unread rows (`k` of them) using the index, already sorted.

For a large table this is the difference between reading millions of rows and reading just a handful — often orders of magnitude faster.

## 6. Is indexing every column a good idea?
**No.** Indexes speed up reads but:
- **Slow down writes** — every `INSERT`/`UPDATE` must also update each index.
- **Use extra storage** and memory.
- **Are wasted** if a column is never used in `WHERE`, `ORDER BY`, or `JOIN`.

Only index the columns you actually filter, sort, or join on. Composite indexes that match real query patterns beat many single-column indexes.

## 7. Students who received a Placement notification in the last 7 days
```sql
SELECT DISTINCT studentId
FROM notifications
WHERE type = 'Placement'
AND createdAt >= now() - INTERVAL '7 days';
```

---

# Stage 4

**What this asks:** The DB is hit on every page load and is overwhelmed. Improve performance and discuss caching, pagination, read replicas, plus tradeoffs.

## The core idea
Stop sending every page load straight to the primary database. Serve repeated reads from a cache, send only small pages of data, and spread read traffic across replicas.

## 1. Caching (Redis)
- Cache the unread count and the first page of notifications per student, with a short TTL (e.g. 30–60s). Invalidate on new notification or mark-as-read.
- **Tradeoff:** data can be slightly stale, and cache invalidation adds complexity. Good for read-heavy, rarely-changing data like a notification list.

## 2. Pagination
- Never return the full history. Use `LIMIT`/`OFFSET`, or better **keyset (cursor) pagination** using `createdAt < lastSeenCreatedAt`.
- **Tradeoff:** `OFFSET` gets slow on deep pages (it still scans skipped rows); cursor pagination is faster but can't jump to an arbitrary page number.

## 3. Read replicas
- Send all reads (list, count) to **replica** databases and keep writes on the **primary**. This spreads load horizontally.
- **Tradeoff:** **replication lag** — a replica may be a moment behind, so a just-created notification might appear slightly late (eventual consistency). Also more infrastructure to run.

## 4. Other appropriate strategy
- **Push instead of poll:** use the Stage 1 WebSocket/SSE channel so the client updates in real time instead of re-querying on every page load. This removes most of the read load at the source.
- **Tradeoff:** needs a live connection layer to maintain, but it is the most effective fix for "queried on every load."

## Summary of tradeoffs
| Strategy | Gain | Cost |
|---|---|---|
| Caching | Fewer DB hits, fast reads | Stale data, invalidation logic |
| Pagination | Small, fast responses | Deep-page cost / no random page jump |
| Read replicas | Spreads read load | Replication lag, more infra |
| Real-time push | Removes repeated polling | Connection layer to manage |

---

# Stage 5

**What this asks:** Reliably send email + in-app notifications to 50,000 students. Find the flaws in the naive loop and design a queue-based, retryable architecture.

## Current pseudocode
```text
for each student:
    send_email()
    save_to_db()
    push_to_app()
```

## 1. Shortcomings
- **Synchronous and sequential:** 50,000 students are processed one by one in a single request — extremely slow and likely to time out.
- **No isolation:** one slow or failing `send_email()` blocks everyone after it.
- **No retries:** a temporary email failure is lost permanently.
- **No tracking:** we don't know which students succeeded or failed.
- **Tight coupling:** a flaky external email service is mixed with reliable internal DB writes.

## 2. What happens if send_email fails for 200 students?
In the naive loop, those 200 failures either throw and **stop the whole loop** (remaining students never get notified) or are **silently swallowed and lost** — with **no retry and no record**, so those 200 students simply never receive their notification and nobody knows.

## 3. Reliable architecture
```text
Producer (API)  ->  Message Queue  ->  Worker pool
                                         |-- send_email (with retry)
                                         |-- on repeated failure -> Dead Letter Queue
In-app notification saved to DB first (source of truth), then real-time push via WebSocket/SSE.
```
- A **producer** quickly enqueues one job per student and returns.
- A **pool of workers** consumes jobs in parallel, each handling one student independently.
- Failed email jobs are **retried with backoff**; permanently failing ones go to a **Dead Letter Queue** for later inspection.

## 4 & 5. Should save_to_db and send_email happen together? Why?
**No — keep them separate.** `save_to_db()` is fast, internal, and reliable; `send_email()` is slow, external, and can fail. If they share one transaction, the unreliable email blocks or rolls back the reliable DB write — and you cannot "roll back" an email that was already sent. So **save the in-app notification to the DB first** (it becomes the source of truth), then **enqueue the email separately** to be delivered by a worker.

## 6. Improved pseudocode
```text
# API request (producer) - returns fast
for each student in batch:
    save_to_db(notification)        # source of truth, in-app notification ready
    queue.enqueue(emailJob, student) # hand email off to the queue
push_to_app via WebSocket/SSE        # real-time in-app delivery

# Email worker (runs in parallel, many workers)
on receive emailJob:
    try:
        send_email(student)
        mark_email_sent(student)
    catch error:
        if attempts < MAX_RETRIES:
            requeue_with_backoff(emailJob)
        else:
            move_to_dead_letter_queue(emailJob)
```

## 7. Key concepts
- **Message Queue:** decouples sending from the request, smooths the 50,000-job burst, and lets many workers process in parallel.
- **Retry Mechanism:** transient failures (timeouts, rate limits) are retried with increasing delay instead of being lost.
- **Dead Letter Queue (DLQ):** jobs that keep failing are parked separately so they can be inspected and re-driven, without blocking the main queue.
- **Reliability:** every student's email is tracked, retried, and never silently dropped; the in-app notification is always saved even if email is delayed.
