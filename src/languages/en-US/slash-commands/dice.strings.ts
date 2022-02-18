export default
{
  metadata: {
    description: 'Roll some dice',
    options: {
      dice: 'The number of dice to roll (default: 1)',
      sides: 'The number of sides on the dice (default: 6)'
    }
  },
  response: '{username} rolled {diceCount}d{diceSides} and got {total}'
}
