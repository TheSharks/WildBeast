export default {
  metadata: {
    descriptions: {
      create: "Créer un nouveau tag",
      delete: "Supprimer un tag",
      edit: "Modifier un tag",
      info: "Obtenir des informations sur une balise",
      show: "Afficher une étiquette"
    },
    options: {
      name: "Le nom de la balise",
      content: "Le contenu de la balise",
      args: "Les arguments à passer à la commande"
    }
  },
  errors: {
    notFound: "Aucune balise de ce type",
    conflict: "Une balise portant ce nom existe déjà",
    illegal: "Tu ne peux pas nommer ton tag comme ça",
    notYours: "Vous ne possédez pas ce tag, donc vous ne pouvez pas le modifier."
  },
  owner: "Le propriétaire de cette balise est {user}",
  created: "Votre étiquette a été créée",
  deleted: "Votre tag a été supprimé",
  edited: "Votre tag a été modifié",
  createdAt: "Créé à",
  updatedAt: "Mis à jour à",
  ranking: "Classement"
};