## POST to me

其中，type变量的值对应消息类型，仅 1（文本）可选。下同。

```
{
	"url": "https://api-bot.aibotk.com/openapi/v1/chat/contact",
	"method": "POST",
	"header": {
		"Content-Type": "application/json"
	},
	"body": {
		"apiKey": "在`/home/ubuntu/rsshub/.env`中",
		"message": {
			"content": "测试测试",
			"type": 1
		},
		"wxid": "zhj563994660"
	}
}
```

## POST to Groups

```
{
	"url": "https://api-bot.aibotk.com/openapi/v1/chat/room",
	"method": "POST",
	"header": {
		"Content-Type": "application/json"
	},
	"body": {
		"apiKey": "在`/home/ubuntu/rsshub/.env`中",
		"message": {
			"content": "测试测试",
			"type": 1
		},
		"roomName": "群名成"
	}
}
```

## POST 要求

如果用户提供了多个wxid或 roomName，使用随机 5-10s 间隔逐个发送。