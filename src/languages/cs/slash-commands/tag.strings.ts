export default {
  metadata: {
    descriptions: {
      create: "Vytvoření nové značky",
      delete: "Odstranění značky",
      edit: "Upravit značku",
      info: "Získání informací o značce",
      show: "Zobrazit značku"
    },
    options: {
      name: "Název značky",
      content: "Obsah značky",
      args: "Argumenty, které se předávají příkazu"
    }
  },
  errors: {
    notFound: "Žádná taková značka",
    conflict: "Značka s tímto názvem již existuje",
    illegal: "Nemůžete svou značku pojmenovat takto",
    notYours: "Tuto značku nevlastníte, takže ji nemůžete upravovat."
  },
  owner: "Vlastníkem této značky je {user}",
  created: "Vaše značka byla vytvořena",
  deleted: "Vaše značka byla odstraněna",
  updated: false,
  createdAt: "Vytvořeno v",
  updatedAt: "Aktualizováno na",
  ranking: "Pořadí"
};