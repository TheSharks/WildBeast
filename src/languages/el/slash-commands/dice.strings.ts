export default {
  metadata: {
    description: "Ρίξτε μερικά ζάρια",
    options: {
      dice: "Ο αριθμός των ζαριών που θα ριχτούν (προεπιλογή: 1)",
      sides: "Ο αριθμός των πλευρών του ζαριού (προεπιλογή: 6)"
    }
  },
  response: "{username} έριξε {diceCount}d{diceSides} και πήρε {total}"
};