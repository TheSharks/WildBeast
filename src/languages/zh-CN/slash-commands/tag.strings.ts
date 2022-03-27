export default {
  metadata: {
    descriptions: {
      create: "创建一个新的标签",
      delete: "删除一个标签",
      edit: "编辑一个标签",
      info: "获取一个标签的信息",
      show: "显示一个标签"
    },
    options: {
      name: "标签的名称",
      content: "标签的内容",
      args: "传递给命令的参数"
    }
  },
  errors: {
    notFound: "没有这样的标签",
    conflict: "一个具有该名称的标签已经存在",
    illegal: "你不能给你的标签起这样的名字",
    notYours: "你不拥有这个标签，所以你不能编辑它。"
  },
  owner: "该标签的所有者是 {user}",
  created: "您的标签已创建",
  deleted: "您的标签已被删除",
  updated: false,
  createdAt: "创建于",
  updatedAt: "更新于",
  ranking: "排名"
};