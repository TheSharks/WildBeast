export default {
  metadata: {
    description: "Würfeln Sie",
    options: {
      dice: "Die Anzahl der zu würfelnden Würfel (Standard: 1)",
      sides: "Die Anzahl der Seiten des Würfels (Standard: 6)"
    }
  },
  response: "{username} würfelte {diceCount}d{diceSides} und erhielt {total}"
};