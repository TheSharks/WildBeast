export default {
  metadata: {
    description: "Gooi wat dobbelstenen",
    options: {
      dice: "Het aantal dobbelstenen dat moet worden gegooid (standaard: 1)",
      sides: "Het aantal zijden van de dobbelsteen (standaard: 6)"
    }
  },
  response: "{username} rolde {diceCount}d{diceSides} en kreeg {total}"
};