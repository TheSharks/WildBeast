export default {
  metadata: {
    description: "Slå några tärningar",
    options: {
      dice: "Antalet tärningar som ska kastas (standard: 1).",
      sides: "Antalet sidor på tärningen (standard: 6)."
    }
  },
  response: "{username} kastade {diceCount}d{diceSides} och fick {total}"
};