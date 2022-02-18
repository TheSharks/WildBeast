export default {
  metadata: {
    description: "Хвърляне на зарове",
    options: {
      dice: "Броят на заровете за хвърляне (по подразбиране: 1)",
      sides: "Броят на страните на заровете (по подразбиране: 6)"
    }
  },
  response: "{username} хвърли {diceCount}d{diceSides} и получи {total}"
};