import streamlit as st
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
from skimage.metrics import peak_signal_noise_ratio as psnr
import io
import time

st.set_page_config(page_title="P2P Image Compression Simulator", layout="wide")

st.title("P2P Image Compression & Evaluation Simulator")
st.write("Visualize how images are compressed, sent over a chatroom, and evaluated for feature loss.")

st.sidebar.header("Chatroom Settings")
uploaded_file = st.sidebar.file_uploader("Upload an Image to Send", type=["jpg", "jpeg", "png"])
compression_format = st.sidebar.selectbox("Encoding Format", [".webp", ".jpg", ".png"])

# Handle quality slider differently based on format
if compression_format == '.png':
    quality = st.sidebar.slider("PNG Compression Level (0 = none, 9 = max)", 0, 9, 3)
    st.sidebar.warning("Note: PNG is lossless. SSIM/PSNR will be perfect, but file size will be larger.")
else:
    quality = st.sidebar.slider("Compression Quality (1 = lowest, 100 = best)", 1, 100, 30)

if uploaded_file is not None:
    # 1. Read the uploaded image from bytes
    file_bytes = np.asarray(bytearray(uploaded_file.read()), dtype=np.uint8)
    original_img_bgr = cv2.imdecode(file_bytes, 1)
    original_size_kb = len(file_bytes) / 1024

    st.markdown("---")
    
    col1, col2 = st.columns(2)

    with col1:
        st.header("👤 User 1 (Sender)")
        st.image(cv2.cvtColor(original_img_bgr, cv2.COLOR_BGR2RGB), caption=f"Original Image ({original_size_kb:.2f} KB)", use_container_width=True)

    # 2. Compress (Simulating network transmission)
    st.sidebar.button("Send Image ➡️")
    
    encimg = None
    if compression_format == '.webp':
        encode_param = [int(cv2.IMWRITE_WEBP_QUALITY), quality]
        result, encimg = cv2.imencode('.webp', original_img_bgr, encode_param)
    elif compression_format == '.jpg':
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        result, encimg = cv2.imencode('.jpg', original_img_bgr, encode_param)
    elif compression_format == '.png':
        encode_param = [int(cv2.IMWRITE_PNG_COMPRESSION), quality]
        result, encimg = cv2.imencode('.png', original_img_bgr, encode_param)
    
    compressed_bytes = encimg.tobytes()
    compressed_size_kb = len(compressed_bytes) / 1024
    
    # 3. Receiver side
    with col2:
        st.header("👤 User 2 (Receiver)")
        
        # Decode the received bytes
        received_bytes = np.frombuffer(compressed_bytes, dtype=np.uint8)
        compressed_img_bgr = cv2.imdecode(received_bytes, 1)
        
        st.image(cv2.cvtColor(compressed_img_bgr, cv2.COLOR_BGR2RGB), caption=f"Received {compression_format.upper()} Image ({compressed_size_kb:.2f} KB)", use_container_width=True)

    # 4. Metrics & Evaluation
    st.markdown("---")
    st.header("📊 Feature Loss Evaluation")
    
    # Using progress bar to simulate calculation time
    with st.spinner('Calculating SSIM and PSNR...'):
        time.sleep(0.5) # Simulate processing delay
        gray_original = cv2.cvtColor(original_img_bgr, cv2.COLOR_BGR2GRAY)
        gray_compressed = cv2.cvtColor(compressed_img_bgr, cv2.COLOR_BGR2GRAY)
        
        # Calculate SSIM and Difference Map
        score_ssim, diff_map = ssim(gray_original, gray_compressed, full=True)
        # Calculate PSNR
        score_psnr = psnr(original_img_bgr, compressed_img_bgr)
        
    m1, m2, m3 = st.columns(3)
    reduction = (1 - compressed_size_kb / original_size_kb) * 100 if original_size_kb > 0 else 0
    
    m1.metric("📦 File Size Reduction", f"{reduction:.1f}%", f"{original_size_kb:.1f} KB ➔ {compressed_size_kb:.1f} KB", delta_color="inverse")
    m2.metric("👁️ SSIM (Structural Similarity)", f"{score_ssim:.4f}", "1.0 is Perfect Match", delta_color="off")
    m3.metric("📈 PSNR (Peak Signal-to-Noise)", f"{score_psnr:.2f} dB", "Higher is better (>30 is good)", delta_color="off")

    st.markdown("---")
    
    # 5. Difference Map
    st.subheader("🔍 Visual Difference Map (Features Lost)")
    st.write("Darker pixels (black spots) indicate areas where the compression lost details compared to the original.")
    
    # Scale difference map from 0-1 to 0-255
    diff_map_scaled = (diff_map * 255).astype("uint8")
    
    # Invert so identical pixels are white, differences are black (easier to see)
    diff_map_inverted = cv2.bitwise_not(diff_map_scaled)
    
    # Show difference map
    st.image(diff_map_inverted, caption="Difference Map (White = identical, Black = detail lost)", use_container_width=True)
else:
    st.info("👈 Please upload an image from the sidebar to start the simulation.")