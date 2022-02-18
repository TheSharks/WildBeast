export default {
  metadata: {
    description: "Rzuć trochę kostką",
    options: {
      dice: "Liczba kostek do rzucenia (domyślnie: 1)",
      sides: "Liczba stron na kostce (domyślnie: 6)"
    }
  },
  response: "{username} toczył się {diceCount}d{diceSides} i otrzymał {total}."
};