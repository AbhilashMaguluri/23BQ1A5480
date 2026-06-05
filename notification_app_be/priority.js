const typeRank = { Placement: 3, Result: 2, Event: 1 };

function getPriorityRank(type) {
  return typeRank[type] || 0;
}

function computeTop10(notifications) {
  const sorted = notifications.slice().sort(function (a, b) {
    const rankA = getPriorityRank(a.Type);
    const rankB = getPriorityRank(b.Type);
    if (rankA !== rankB) {
      return rankB - rankA;
    }
    const timeA = new Date(a.Timestamp).getTime();
    const timeB = new Date(b.Timestamp).getTime();
    return timeB - timeA;
  });
  return sorted.slice(0, 10);
}

module.exports = { getPriorityRank, computeTop10 };
