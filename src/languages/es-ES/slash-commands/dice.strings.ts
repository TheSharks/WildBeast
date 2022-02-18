export default {
  metadata: {
    description: "Tira unos dados",
    options: {
      dice: "El número de dados a lanzar (por defecto: 1)",
      sides: "El número de caras del dado (por defecto: 6)"
    }
  },
  response: "{username} rodó {diceCount}d{diceSides} y obtuvo {total}"
};