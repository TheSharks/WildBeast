export default {
  metadata: {
    descriptions: {
      create: "Sukurti naują žymą",
      delete: "Ištrinti žymą",
      edit: "Redaguoti žymą",
      info: "Gauti informacijos apie žymą",
      show: "Rodyti žymą"
    },
    options: {
      name: "Žymos pavadinimas",
      content: "Žymos turinys",
      args: "Argumentai, kuriuos reikia perduoti komandai"
    }
  },
  errors: {
    notFound: "Tokios žymos nėra",
    conflict: "Žyma su tokiu pavadinimu jau egzistuoja",
    illegal: "Negalite pavadinti savo žymės taip",
    notYours: "Ši žyma jums nepriklauso, todėl negalite jos redaguoti"
  },
  owner: "Šios žymės savininkas yra {user}",
  created: "Jūsų žyma buvo sukurta",
  deleted: "Jūsų žyma buvo ištrinta",
  updated: false,
  createdAt: "Sukurta ne",
  updatedAt: "Atnaujinta",
  ranking: "Reitingas"
};