import socket
import threading
import sys
import os
import cv2
import numpy as np
import argparse
from skimage.metrics import structural_similarity as ssim
from skimage.metrics import peak_signal_noise_ratio as psnr

BUFFER_SIZE = 4096

def calculate_metrics(original_path, compressed_path):
    if not os.path.exists(original_path) or not os.path.exists(compressed_path):
        print("Error: Could not find images to calculate metrics.")
        return

    original_img = cv2.imread(original_path)
    compressed_img = cv2.imread(compressed_path)

    gray_original = cv2.cvtColor(original_img, cv2.COLOR_BGR2GRAY)
    gray_compressed = cv2.cvtColor(compressed_img, cv2.COLOR_BGR2GRAY)

    score_ssim, diff_map = ssim(gray_original, gray_compressed, full=True)
    score_psnr = psnr(original_img, compressed_img)
    
    orig_size = os.path.getsize(original_path) / 1024
    comp_size = os.path.getsize(compressed_path) / 1024
    reduction = (1 - comp_size/orig_size)*100 if orig_size > 0 else 0
    
    print("\n┌────────────────────────────────────────────────────────┐")
    print("│               COMPRESSION & LOSS REPORT                │")
    print("├────────────────────────────────────────────────────────┤")
    print(f"│ Original Size:     {orig_size:.2f} KB".ljust(57) + "│")
    print(f"│ Compressed Size:   {comp_size:.2f} KB ({reduction:.1f}% reduction)".ljust(57) + "│")
    print("│                                                        │")
    print("│ Feature Loss Metrics (Difference from original):       │")
    print(f"│ • SSIM Index:      {score_ssim:.4f} (Closer to 1.0 is better) ".ljust(57) + "│")
    print(f"│ • PSNR Score:      {score_psnr:.2f} dB (Higher is better)     ".ljust(57) + "│")
    print("└────────────────────────────────────────────────────────┘\n")

def receive_messages(sock):
    while True:
        try:
            message_type = sock.recv(1).decode('utf-8')
            if not message_type:
                print("Connection closed by peer.")
                os._exit(0)

            if message_type == 'T': # Text message
                msg_len_bytes = sock.recv(4)
                msg_len = int.from_bytes(msg_len_bytes, 'big')
                message = sock.recv(msg_len).decode('utf-8')
                print(f"\nPeer: {message}")

            elif message_type == 'I': # Image message
                print("\n[Receiving compressed image...]")
                filename_len_bytes = sock.recv(4)
                filename_len = int.from_bytes(filename_len_bytes, 'big')
                filename = sock.recv(filename_len).decode('utf-8')
                
                file_size_bytes = sock.recv(8)
                file_size = int.from_bytes(file_size_bytes, 'big')

                received_filename = f"received_{filename}"
                with open(received_filename, 'wb') as f:
                    bytes_received = 0
                    while bytes_received < file_size:
                        chunk = sock.recv(min(file_size - bytes_received, BUFFER_SIZE))
                        if not chunk:
                            break
                        f.write(chunk)
                        bytes_received += len(chunk)
                
                print(f"[Image received and saved as {received_filename}]")
                # Attempt to locally compare if the original exists in the same folder for testing
                if os.path.exists(filename):
                    calculate_metrics(filename, received_filename)

        except Exception as e:
            print(f"Error receiving data: {e}")
            os._exit(0)

def compress_image(image_path, quality=30):
    original_img = cv2.imread(image_path)
    if original_img is None:
        return None
    
    encode_param = [int(cv2.IMWRITE_WEBP_QUALITY), quality]
    result, encimg = cv2.imencode('.webp', original_img, encode_param)
    return encimg.tobytes() if result else None

def send_messages(sock):
    while True:
        try:
            msg = input()
            if msg.startswith("/sendimage "):
                parts = msg.split(" ", 2)
                image_path = parts[1]
                quality = int(parts[2]) if len(parts) > 2 else 30
                
                if not os.path.exists(image_path):
                    print("File does not exist.")
                    continue

                compressed_data = compress_image(image_path, quality)
                if compressed_data is None:
                    print("Failed to compress image.")
                    continue
                
                print(f"Sending compressed image (Original: {os.path.getsize(image_path)/1024:.2f}KB, Compressed: {len(compressed_data)/1024:.2f}KB)...")
                
                filename = os.path.basename(image_path)
                sock.sendall(b'I')
                
                filename_bytes = filename.encode('utf-8')
                sock.sendall(len(filename_bytes).to_bytes(4, 'big'))
                sock.sendall(filename_bytes)
                
                sock.sendall(len(compressed_data).to_bytes(8, 'big'))
                sock.sendall(compressed_data)
                print("Image sent successfully.")
                
            else:
                sock.sendall(b'T')
                msg_bytes = msg.encode('utf-8')
                sock.sendall(len(msg_bytes).to_bytes(4, 'big'))
                sock.sendall(msg_bytes)
        except Exception as e:
            print(f"Error sending data: {e}")
            os._exit(0)

def main():
    parser = argparse.ArgumentParser(description="P2P Chat with Image Compression")
    parser.add_argument('--host', action='store_true', help='Host the chatroom')
    parser.add_argument('--connect', type=str, help='Connect to a host IP')
    parser.add_argument('--port', type=int, default=5000, help='Port to use')
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    if args.host:
        sock.bind(('0.0.0.0', args.port))
        sock.listen(1)
        print(f"Listening for connection on port {args.port}...")
        conn, addr = sock.accept()
        print(f"Connected to {addr}")
        sock = conn
    elif args.connect:
        print(f"Connecting to {args.connect}:{args.port}...")
        sock.connect((args.connect, args.port))
        print("Connected!")
    else:
        print("Please specify --host or --connect <IP>")
        return

    print("Type your messages. To send an image use: /sendimage <filename> [quality(1-100)]")

    receive_thread = threading.Thread(target=receive_messages, args=(sock,))
    receive_thread.daemon = True
    receive_thread.start()

    send_messages(sock)

if __name__ == "__main__":
    main()
