export default {
  metadata: {
    description: "Meskite kelis kauliukus",
    options: {
      dice: "metamų kauliukų skaičius (numatytoji reikšmė: 1)",
      sides: "kauliuko pusių skaičius (numatytoji reikšmė: 6)"
    }
  },
  response: "{username} sukasi {diceCount}d{diceSides} ir gavo {total}"
};