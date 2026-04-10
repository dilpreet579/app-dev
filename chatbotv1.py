import requests
import json
import cv2
import base64
import whisper
import moviepy.editor as mp
import os

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

def extract_frames(video_path, interval=2):
    cap = cv2.VideoCapture(video_path)
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    frames = []
    count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if count % (fps * interval) == 0:
            _, buffer = cv2.imencode('.jpg', frame)
            frames.append(base64.b64encode(buffer).decode('utf-8'))
        count += 1

    cap.release()
    return frames[:5]  # limit frames (cost control)


def extract_audio(video_path, output_audio="audio.wav"):
    clip = mp.VideoFileClip(video_path)
    clip.audio.write_audiofile(output_audio, verbose=False, logger=None)
    return output_audio


def transcribe_audio(audio_path):
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    return result["text"]


def describe_video(video_path):
    print("🔍 Processing video...")

    frames = extract_frames(video_path)
    audio_path = extract_audio(video_path)
    transcript = transcribe_audio(audio_path)

    frame_messages = []
    for frame in frames:
        frame_messages.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{frame}"
            }
        })

    messages = [
        {
            "role": "system",
            "content": "You are an AI that describes videos in detail."
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": f"Transcript: {transcript}"},
                {"type": "text", "text": "Describe the video based on these frames and transcript."},
                *frame_messages
            ]
        }
    ]

    payload = {
        "messages": messages,
        "max_tokens": 500
    }

    response = requests.post(endpoint, headers=headers, json=payload)

    if response.status_code == 200:
        return response.json()['choices'][0]['message']['content']
    else:
        return f"Error: {response.text}"

messages = [{"role": "system", "content": "You are a helpful assistant."}]
print("Starting conversation with the CHATBOT... (type 'quit' or 'exit' to stop)")
print("Type: /video path/to/video.mp4 OR normal chat")

while True:
    try:
        user_input = input("\nYou: ")
        if user_input.lower() in ['quit', 'exit']:
            print("Ending conversation.")
            break
            

        # VIDEO MODE
        if user_input.startswith("/video"):
            video_path = user_input.split(" ", 1)[1]

            if not os.path.exists(video_path):
                print("❌ File not found")
                continue

            description = describe_video(video_path)
            print(f"\n🎥 Description:\n{description}")
            continue

        # NORMAL CHAT MODE
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