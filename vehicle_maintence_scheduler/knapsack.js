function solveKnapsack(items, capacity) {
  const n = items.length;

  const dp = [];
  for (let i = 0; i <= n; i++) {
    dp.push(new Array(capacity + 1).fill(0));
  }

  for (let i = 1; i <= n; i++) {
    const duration = items[i - 1].Duration;
    const impact = items[i - 1].Impact;

    for (let w = 0; w <= capacity; w++) {
      dp[i][w] = dp[i - 1][w];

      if (duration <= w) {
        const valueIfTaken = dp[i - 1][w - duration] + impact;
        if (valueIfTaken > dp[i][w]) {
          dp[i][w] = valueIfTaken;
        }
      }
    }
  }

  const selected = [];
  let w = capacity;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      const chosenVehicle = items[i - 1];
      selected.push(chosenVehicle);
      w = w - chosenVehicle.Duration;
    }
  }
  selected.reverse();

  let totalImpact = 0;
  let totalDuration = 0;
  for (const vehicle of selected) {
    totalImpact += vehicle.Impact;
    totalDuration += vehicle.Duration;
  }

  return { selected, totalImpact, totalDuration };
}

module.exports = solveKnapsack;
