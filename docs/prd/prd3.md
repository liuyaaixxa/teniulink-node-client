新需求：
1：我设置-模型服务-配置了huggingface的推理服务，能应用所有模型；huggingface是默认兼容OPenai API的规范的。
2：期望本地apikey server 能独立这个服务。http：//localhost:23333/v1/models; Authorization: Bearer cs-sk-309b6935-c11b-428b-8f52-1f3f6d3aa2ac
请测试下是否可以实现。请认真测试下。
类似Ollama； 如下啊
curl -X POST http://localhost:23333/v1/chat/completions \
  -H "Authorization: Bearer cs-sk-ad1071e8-6870-490e-b496-fe45a2bed631" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "1b667117-e0e4-4264-abc1-6827040f51b0:ollama:gemma3:4b",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ],
    "temperature": 0.7
  }'