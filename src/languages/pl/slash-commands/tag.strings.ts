export default {
  metadata: {
    descriptions: {
      create: "Utwórz nowy tag",
      delete: "Usuń znacznik",
      edit: "Edytuj tag",
      info: "Uzyskaj informacje o tagu",
      show: "Pokaż znacznik"
    },
    options: {
      name: "Nazwa znacznika",
      content: "Zawartość tagu",
      args: "Argumenty do przekazania do polecenia"
    }
  },
  errors: {
    notFound: "Brak takiego tagu",
    conflict: "Znacznik o tej nazwie już istnieje",
    illegal: "Nie możesz nazwać swojego tagu w ten sposób",
    notYours: "Nie jesteś właścicielem tego tagu, więc nie możesz go edytować."
  },
  owner: "Właścicielem tego tagu jest {user}.",
  created: "Twój tag został utworzony",
  deleted: "Twój tag został usunięty",
  updated: false,
  createdAt: "Utworzono w",
  updatedAt: "Aktualizowane na",
  ranking: 'Ranking'
};