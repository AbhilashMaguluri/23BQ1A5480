# Campus Hiring Backend Assessment

## Project Overview

This repository contains the backend solutions for a campus hiring assessment. It includes a logging middleware, a vehicle maintenance scheduler, a notification system design document, and a priority inbox implementation. All coding tasks are written in JavaScript using Node.js and Express.

## Project Structure

```
.
├── logging_middleware/
│   ├── auth.js
│   ├── logger.js
│   └── testLogger.js
├── vehicle_maintence_scheduler/
│   ├── knapsack.js
│   ├── scheduler.js
│   ├── result.json
│   └── screenshots/
├── notification_app_be/
│   ├── priority.js
│   ├── inbox.js
│   └── screenshots/
├── notification_system_design.md
├── server.js
├── package.json
└── .gitignore
```

## Setup

```
npm install
npm start
```

## API Endpoints

- `GET /api/scheduler` - Returns the selected vehicles that give the highest impact within the available mechanic hours.
- `GET /api/inbox` - Returns the list of notifications fetched from the notifications API.
- `GET /api/priority` - Returns the top 10 notifications ordered by priority and recency.

## Notes

- The application uses protected external APIs to fetch data.
- Environment variables are required and must be stored in a `.env` file.
- No database is used in this project.
- Output screenshots are included in the repository.
