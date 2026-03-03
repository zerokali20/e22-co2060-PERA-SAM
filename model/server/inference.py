import librosa
import numpy as np
import tensorflow as tf
import os
import sys
import glob
import yaml
import json

# Base path for assets
ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")

class SoundAnalyzer:
    def __init__(self):
        # Baseline Parameters from Hitachi MIMII
        self.n_mels = 64
        self.n_fft = 1024
        self.hop_length = 512
        self.n_frames = 5 # Sliding window of 5 frames used as model input
        
        self.models = {}
        self.metrics = {}
        self.load_all_models()
        self.load_metrics()

    def load_metrics(self):
        """Loads model performance metrics if available."""
        metrics_path = os.path.join(ASSETS_DIR, "metrics.yaml")
        if os.path.exists(metrics_path):
            try:
                with open(metrics_path, 'r') as f:
                    self.metrics = yaml.safe_load(f)
                print(f"Metrics loaded from {metrics_path}")
            except Exception as e:
                print(f"Error loading metrics: {e}")

    def load_all_models(self):
        """Loads all .h5 models found in the assets directory."""
        h5_files = glob.glob(os.path.join(ASSETS_DIR, "*.h5"))
        
        if not h5_files:
            print(f"Warning: No .h5 models found in {ASSETS_DIR}")
            return

        for model_path in h5_files:
            filename = os.path.basename(model_path)
            try:
                # Assuming naming pattern: model_CATEGORY_id_ID_dataset.h5
                # e.g., model_fan_id_00_dataset.h5
                parts = filename.split('_')
                if len(parts) >= 4:
                    category = parts[1] # "fan"
                    machine_id = parts[3] # "00"
                    
                    if category not in self.models:
                        self.models[category] = {}
                    
                    self.models[category][machine_id] = tf.keras.models.load_model(model_path)
                    print(f"Model loaded: Category={category}, ID={machine_id} ({filename})")
                else:
                    self.models["default"] = tf.keras.models.load_model(model_path)
                    print(f"Default model loaded: {filename}")
            except Exception as e:
                print(f"Error loading model {filename}: {e}")

    def predict(self, file_path, category=None, machine_id=None):
        # 1. Preprocess the audio once for all comparisons
        try:
            y, sr = librosa.load(file_path, sr=16000)
            mel_spectrogram = librosa.feature.melspectrogram(
                y=y, sr=sr, n_fft=self.n_fft, hop_length=self.hop_length, n_mels=self.n_mels
            )
            log_mel_spectrogram = librosa.power_to_db(mel_spectrogram, ref=1.0)
            
            num_frames = log_mel_spectrogram.shape[1]
            vector_array_size = num_frames - self.n_frames + 1
            if vector_array_size <= 0:
                raise ValueError("Audio too short")
                
            vectors = np.zeros((vector_array_size, self.n_mels * self.n_frames))
            for t in range(self.n_frames):
                vectors[:, self.n_mels * t: self.n_mels * (t + 1)] = \
                    log_mel_spectrogram[:, t: t + vector_array_size].T
        except Exception as e:
            return {"status": "Error", "message": f"Processing failed: {str(e)}"}

        # 2. Find the best matching model
        best_model = None
        best_id = "unknown"
        best_mse = float('inf')
        
        models_to_test = {}
        if category in self.models and isinstance(self.models[category], dict):
            if machine_id in self.models[category]:
                # Force specific ID
                models_to_test = {machine_id: self.models[category][machine_id]}
            else:
                # Test all models in category to auto-identify
                models_to_test = self.models[category]
        elif "default" in self.models:
            models_to_test = {"default": self.models["default"]}
        
        if not models_to_test:
            return {
                "status": "No Model",
                "message": f"No models found for category '{category}'"
            }

        # Run inference against all candidate models
        for mid, mobj in models_to_test.items():
            reconstructed = mobj.predict(vectors, verbose=0)
            mse = np.mean(np.square(vectors - reconstructed), axis=1)
            avg_mse = np.mean(mse)
            
            if avg_mse < best_mse:
                best_mse = avg_mse
                best_model = mobj
                best_id = mid

        # Final identification
        model = best_model
        anomaly_score = best_mse
        used_model_id = best_id
        used_category = category or "unknown"
        
        # Determine model AUC and reliability
        model_auc = 0.0
        metric_key = f"{used_category}_id_{used_model_id}_dataset"
        if metric_key in self.metrics:
            model_auc = self.metrics[metric_key].get('AUC', 0.0)
        
        reliability = "High" if model_auc > 0.85 else "Medium" if model_auc > 0.7 else "Low (Generic Pattern)"
        if used_model_id == "default":
            reliability = "Standard (General Purpose)"
        
        # 4. Dynamic Threshold Logic based on Model Reliability (AUC)
        # Low AUC (e.g. 0.60) means the model is 'noisy' and needs a higher threshold.
        # High AUC (e.g. 0.98) means we can trust the model more and use a tighter threshold.
        
        # Base threshold for your specific decibel scale
        base_threshold = 22.0 # Adjusted based on your observation of 20-25 for normal sounds
        
        # Adjust threshold based on AUC (Inverse relationship: better model -> stricter check)
        # If AUC is 1.0, threshold is base. If AUC is 0.5, threshold is 2x base.
        if model_auc > 0:
            dynamic_factor = 1.0 + (1.0 - model_auc) * 1.5 
            threshold = base_threshold * dynamic_factor
        else:
            threshold = base_threshold
        
        # Multi-point status check
        is_anomaly = anomaly_score > threshold
        is_warning = anomaly_score > (threshold * 0.8) and not is_anomaly
        
        # Dynamic health score calculation
        if anomaly_score < (threshold * 0.8):
            # Healthy: Above 85%
            health_score = 100 - (anomaly_score / (threshold * 0.8) * 15)
        elif not is_anomaly:
            # Warning Zone: 70% to 85%
            health_score = 85 - ((anomaly_score - threshold * 0.8) / (threshold * 0.2) * 15)
        else:
            # Anomaly: Below 70%
            health_score = max(0, 70 - ((anomaly_score - threshold) / threshold * 70))

        status_label = "Anomaly" if is_anomaly else "Warning" if is_warning else "Normal"
        engine_health = "Critical" if is_anomaly else "Degrading" if is_warning else "Good"
        recommendation = (
            "URGENT: Machine failure imminent. Stop operation." if is_anomaly else
            "CAUTION: Unusual patterns detected. Schedule maintenance." if is_warning else
            "Healthy: Machine operating within normal parameters."
        )

        return {
            "status": status_label,
            "score": float(anomaly_score),
            "max_frame_error": float(np.max(mse)),
            "min_frame_error": float(np.min(mse)),
            "threshold_used": round(float(threshold), 2),
            "health_percentage": round(float(health_score), 2),
            "engine_health": engine_health,
            "recommendation": recommendation,
            "machine_id": used_model_id,
            "machine_category": used_category,
            "model_auc": float(model_auc) if model_auc > 0 else 0.0,
            "detection_reliability": reliability,
            "baseline_compliant": True
        }
