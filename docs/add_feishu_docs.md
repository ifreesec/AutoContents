## 获取 tenant_access_token
> tenant_access_token 的最大有效期是 2 小时。
> 剩余有效期小于 30 分钟时，调用本接口会返回一个新的 tenant_access_token，这会同时存在两个有效的 tenant_access_token。
> 剩余有效期大于等于 30 分钟时，调用本接口会返回原有的 tenant_access_token。

请求示例：
```
curl -i -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
-H 'Content-Type: application/json' \
-d '{
	"app_id": "$app_id",
	"app_secret": "$app_secret"
}'
```
返回示例：
```
{
    "code": 0,
    "msg": "ok",
    "tenant_access_token": "t-cae……",
    "expire": 7200
}
```
## 创建知识库节点-创建存储每天的时报的文档

请求示例：
```
curl -i -X POST 'https://open.feishu.cn/open-apis/wiki/v2/spaces/:space_id/nodes' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $tenant_access_token' \
-d '{
	"node_type": "origin",
	"obj_type": "docx",
	"parent_node_token": "$parent_node_token",
	"title": "YYYY-MM-DD"
}'
```
返回示例：
```
{
  "code": 0,
  "data": {
    "node": {
      "creator": "",
      "has_child": false,
      "node_create_time": "1771825539",
      "node_token": "Jn****Rd",//后续写入文档的document_id和block_id的值
      "node_type": "origin",
      "obj_create_time": "1771825539",
      "obj_edit_time": "1771825539",
      "obj_token": "ZD****ab",
      "obj_type": "docx",
      "origin_node_token": "Jn****Rd",
      "origin_space_id": "75****68",
      "owner": "ou_61****e1",
      "parent_node_token": "CG****bg",
      "space_id": "75****68",
      "title": "2026-02-22"
    }
  },
  "msg": "success"
}
```

## Markdown转文档节点-把时报转化为可以写入文档的嵌套快

> 响应体中`data.blocks`为array[object]类型，把里面 object 的值直接取出来在创建嵌套块时使用就好了
> 响应体中`data.first_level_block_ids`为array[str]类型，把里面的每一个 ID 取出来在创建嵌套块直接使用就好了

请求示例：
```
curl -i -X POST 'https://open.feishu.cn/open-apis/docx/v1/documents/blocks/convert' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $tenant_access_token' \
-d '{
	"content": "### HH时段AI新闻\n#### 新闻标题\n> 新闻概要,巴拉巴拉\n- 来源地址：URL",
	"content_type": "markdown"
}'
```
返回示例：
```
{
  "code": 0,
  "data": {
    "block_id_to_image_urls": [],
    "blocks": [
      {……},
      {……},
      {……}
    ],
    "first_level_block_ids": [
      "",
      "",
      ""
    ]
  },
  "msg": "success"
}
```

## 创建嵌套块-往文档中写入每个时段的新闻

> `document_id`和`block_id`的值相同，为创建知识库节点响应体中`data.node.node_token`的值
> `document_id`全天共用一个，可能需要保存一下？我不确定，只是提醒一下
> 请求参数中`descendants`的值为 Markdown 转文档块返回中`data.blocks`的值；`children_id`的值为`data.first_level_block_ids`的值。

请求示例：
```
curl -i -X POST 'https://open.feishu.cn/open-apis/docx/v1/documents/:document_id/blocks/:block_id/descendant?document_revision_id=-1' \
--header 'Authorization: Bearer $tenant_access_token' \
--header 'Content-Type: application/json; charset=utf-8' \
--data-raw '{
    "index": 0,//新的资讯永远放在文档最前面，所以这里的值始终是 0
    "children_id": [
        "",
        ""
    ],
    "descendants": [
        {……},
        {……},
        {……}
    ]
}'
```
响应体字段：
```
code(int):错误码，非 0 表示失败
msg(string):错误描述
data(object):生成的文档块信息
```
