import { defineConfig } from "tinacms";

export default defineConfig({
  branch: "master",
  clientId: "your-tina-cloud-client-id",
  token: "your-tina-cloud-token",
  build: {
    outputFolder: "admin",
    publicFolder: "static",
  },
  media: {
    tina: {
      mediaRoot: "images",
      publicFolder: "static/images",
    },
  },
  schema: {
    collections: [
      {
        name: "news",
        label: "新闻动态",
        path: "content/news",
        fields: [
          {
            type: "string",
            name: "title",
            label: "标题",
            required: true,
          },
          {
            type: "datetime",
            name: "date",
            label: "发布日期",
          },
          {
            type: "string",
            name: "body",
            label: "内容",
            isBody: true,
            ui: {
              component: "textarea",
            },
          },
        ],
      },
      {
        name: "products",
        label: "产品展示",
        path: "content/products",
        fields: [
          {
            type: "string",
            name: "title",
            label: "标题",
            required: true,
          },
          {
            type: "string",
            name: "body",
            label: "内容",
            isBody: true,
            ui: {
              component: "textarea",
            },
          },
        ],
      },
    ],
  },
});