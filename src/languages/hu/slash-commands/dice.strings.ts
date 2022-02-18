export default {
  metadata: {
    description: "Dobj néhány kockát",
    options: {
      dice: "A dobandó kockák száma (alapértelmezett: 1)",
      sides: "A kocka oldalainak száma (alapértelmezett: 6)"
    }
  },
  response: '{username} rolled {diceCount}d{diceSides} and got {total}'
};