export default {
  metadata: {
    descriptions: {
      create: "新規タグの作成",
      delete: "タグの削除",
      edit: "タグの編集",
      info: "タグの情報を取得する",
      show: "タグの表示"
    },
    options: {
      name: "タグの名前",
      content: "タグの内容",
      args: "コマンドに渡す引数"
    }
  },
  errors: {
    notFound: "そのようなタグはありません。",
    conflict: "その名前のタグがすでに存在する",
    illegal: "タグにそのような名前をつけることはできません。",
    notYours: "あなたはそのタグを所有していないので、編集することはできません。"
  },
  owner: "そのタグの所有者は {user} です",
  created: "タグの作成",
  deleted: "あなたのタグは削除されました。",
  updated: false,
  createdAt: "作成場所",
  updatedAt: "更新日",
  ranking: "ランキング"
};