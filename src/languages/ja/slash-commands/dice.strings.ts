export default {
  metadata: {
    description: "サイコロを振る",
    options: {
      dice: "振るサイコロの数（デフォルト：1）",
      sides: "サイコロの面の数（デフォルト：6）"
    }
  },
  response: "{username} が {diceCount}日{diceSides} をロールし、 {total} を獲得"
};