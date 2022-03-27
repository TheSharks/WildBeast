export default {
  metadata: {
    descriptions: {
      create: "Creați o nouă etichetă",
      delete: "Ștergeți o etichetă",
      edit: "Editați o etichetă",
      info: "Obțineți informații despre o etichetă",
      show: "Afișați o etichetă"
    },
    options: {
      name: "Numele etichetei",
      content: "Conținutul etichetei",
      args: "Argumentele care trebuie transmise comenzii"
    }
  },
  errors: {
    notFound: "Nu există o astfel de etichetă",
    conflict: "O etichetă cu acest nume există deja",
    illegal: "Nu-ți poți numi eticheta așa.",
    notYours: "Nu dețineți această etichetă, deci nu o puteți edita."
  },
  owner: "Proprietarul acestei etichete este {user}",
  created: "Eticheta ta a fost creată",
  deleted: "Eticheta ta a fost ștearsă",
  updated: false,
  createdAt: "Creat la",
  updatedAt: "Actualizat la",
  ranking: "Clasament"
};