export default {
  metadata: {
    descriptions: {
      create: "Új címke létrehozása",
      delete: "Címke törlése",
      edit: "Címke szerkesztése",
      info: "Információ lekérése egy címkéről",
      show: "Címke megjelenítése"
    },
    options: {
      name: "A címke neve",
      content: "A címke tartalma",
      args: "A parancsnak átadandó argumentumok"
    }
  },
  errors: {
    notFound: "Nincs ilyen címke",
    conflict: "Egy ilyen nevű címke már létezik",
    illegal: "Nem nevezheted így a címkét",
    notYours: "Ez a címke nem a tiéd, így nem tudod szerkeszteni."
  },
  owner: "A címke tulajdonosa {user}",
  created: "A címkét létrehozták",
  deleted: "A címkét törölték",
  edited: "A címkét szerkesztették",
  createdAt: "Létrehozva",
  updatedAt: "Frissítve",
  ranking: "Rangsorolás"
};