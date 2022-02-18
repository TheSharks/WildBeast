export default {
  metadata: {
    descriptions: {
      create: "Luo uusi tunniste",
      delete: "Poista tunniste",
      edit: "Muokkaa tagia",
      info: "Hae tietoja tunnisteesta",
      show: "Näytä tunniste"
    },
    options: {
      name: "Tunnisteen nimi",
      content: "Tagin sisältö",
      args: "Komennolle annettavat argumentit"
    }
  },
  errors: {
    notFound: "Tällaista tagia ei ole",
    conflict: "Kyseisellä nimellä varustettu tunniste on jo olemassa",
    illegal: "Et voi nimetä tagiasi niin",
    notYours: "Et omista tätä tagia, joten et voi muokata sitä."
  },
  owner: "Tämän tagin omistaja on {user}",
  created: "Tagisi luotiin",
  deleted: "Tagisi poistettiin",
  edited: "Tagiasi on muokattu",
  createdAt: "Created at",
  updatedAt: "Päivitetty osoitteessa",
  ranking: 'Ranking'
};