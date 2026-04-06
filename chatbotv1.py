import requests
import json

# Configuration
api_base = "https://soundverse-assistant-deployment.openai.azure.com/"
deployment_name = "soundverse-saar-gpt-4.1"
api_version = "2025-01-01-preview"
api_key = "8bf19de473d24bffa60f52051052862b"

# Construct the full URL
endpoint = f"{api_base}openai/deployments/{deployment_name}/chat/completions?api-version={api_version}"

headers = {
    "Content-Type": "application/json",
    "api-key": api_key
}

messages = [{"role": "system", "content": "You are a helpful assistant."}]
print("Starting conversation with the CHATBOT... (type 'quit' or 'exit' to stop)")

while True:
    try:
        user_input = input("\nYou: ")
        if user_input.lower() in ['quit', 'exit']:
            print("Ending conversation.")
            break
            
        messages.append({"role": "user", "content": user_input})

        payload = {
            "messages": messages,
            "max_tokens": 150
        }

        response = requests.post(endpoint, headers=headers, json=payload)
        
        if response.status_code == 200:
            reply = response.json()['choices'][0]['message']['content']
            print(f"Assistant: {reply}")
            messages.append({"role": "assistant", "content": reply})
        else:
            print(f"\n❌ FAILED with status code: {response.status_code}")
            print("Error details:", response.text)
            messages.pop() # Remove the failed message so we can try again
            
    except KeyboardInterrupt:
        print("\nEnding conversation.")
        break
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        if messages:
            messages.pop()