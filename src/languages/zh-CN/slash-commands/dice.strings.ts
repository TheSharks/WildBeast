export default {
  metadata: {
    description: "掷一些骰子",
    options: {
      dice: "要掷出的骰子数量（默认：1）。",
      sides: "骰子的面数（默认：6）。"
    }
  },
  response: "{username} 滚动 {diceCount}d{diceSides} 并得到 {total}"
};