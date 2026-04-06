import requests
import json

# Configuration
api_base = "https://soundverse-assistant-deployment.openai.azure.com/"
deployment_name = "soundverse-saar-gpt-4.1"
api_version = "2025-01-01-preview"
api_key = "8bf19de473d24bffa60f52051052862b"  # <--- REPLACE THIS IF "8" IS NOT THE FULL KEY

# Construct the full URL
endpoint = f"{api_base}openai/deployments/{deployment_name}/chat/completions?api-version={api_version}"

headers = {
    "Content-Type": "application/json",
    "api-key": api_key
}

payload = {
    "messages": [
        {"role": "user", "content": "When was your data updated last?"}
    ],
    "max_tokens": 50
}

try:
    print(f"Testing connection to: {endpoint}...")
    response = requests.post(endpoint, headers=headers, json=payload)
    
    # Check status
    if response.status_code == 200:
        print("\n✅ SUCCESS! Credentials are working.")
        print("Response:", response.json()['choices'][0]['message']['content'])
    else:
        print(f"\n❌ FAILED with status code: {response.status_code}")
        print("Error details:", response.text)
        
except Exception as e:
    print(f"\n❌ An error occurred: {e}")