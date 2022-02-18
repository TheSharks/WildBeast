export default {
  metadata: {
    description: "Kast nogle terninger",
    options: {
      dice: "Antallet af terninger, der skal kastes (standard: 1)",
      sides: "Antallet af sider på terningen (standard: 6)"
    }
  },
  response: "{username} kastede {diceCount}d{diceSides} og fik {total}"
};