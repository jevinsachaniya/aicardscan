# ==============================================================================
# CardLens AI - LayoutLMv3 Fine-Tuning Script for Google Colab (Free T4 GPU)
# ==============================================================================
# Instructions:
# 1. Open https://colab.research.google.com/
# 2. Click "New Notebook"
# 3. In menu: Runtime -> Change runtime type -> Select "T4 GPU" -> Click Save
# 4. Copy-paste this entire code into a cell and press the Play (Run) button!
# ==============================================================================

# Step 1: Install required libraries
import subprocess
import sys

print("🚀 Step 1/5: Installing training packages...")
packages = ["transformers", "datasets", "accelerate", "torchvision", "evaluate", "seqeval"]
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q"] + packages)

import os
import torch
import shutil
import numpy as np
from datasets import load_dataset
from transformers import (
    AutoProcessor,
    AutoModelForTokenClassification,
    TrainingArguments,
    Trainer,
    default_data_collator
)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"✅ Device detected: {device.upper()} (GPU Acceleration: {torch.cuda.is_available()})")

# Step 2: Load SROIE Dataset
print("\n📥 Step 2/5: Loading SROIE Document Dataset from Hugging Face...")
raw_dataset = load_dataset("arvindrajan92/sroie_document_understanding")

# Define Target Entity Labels
label_list = [
    "O",
    "B-COMPANY", "I-COMPANY",
    "B-ADDRESS", "I-ADDRESS",
    "B-DATE", "I-DATE",
    "B-TOTAL", "I-TOTAL"
]
label_to_id = {label: i for i, label in enumerate(label_list)}
id_to_label = {i: label for i, label in enumerate(label_list)}

print(f"Labels configured ({len(label_list)} classes): {label_list}")

# Step 3: Initialize LayoutLMv3 Processor
print("\n⚙️ Step 3/5: Initializing LayoutLMv3 Processor...")
processor = AutoProcessor.from_pretrained("microsoft/layoutlmv3-base", apply_ocr=False)

def normalize_bbox(box, width, height):
    """Normalize bounding box to 0-1000 scale required by LayoutLMv3."""
    # box is [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
    x_coords = [p[0] for p in box]
    y_coords = [p[1] for p in box]
    x0 = int(min(x_coords))
    y0 = int(min(y_coords))
    x1 = int(max(x_coords))
    y1 = int(max(y_coords))

    norm_x0 = max(0, min(1000, int(1000 * (x0 / width))))
    norm_y0 = max(0, min(1000, int(1000 * (y0 / height))))
    norm_x1 = max(0, min(1000, int(1000 * (x1 / width))))
    norm_y1 = max(0, min(1000, int(1000 * (y1 / height))))
    return [norm_x0, norm_y0, norm_x1, norm_y1]

def preprocess_function(examples):
    images = examples["image"]
    ocr_data = examples["ocr"]

    all_words = []
    all_boxes = []
    all_labels = []

    for img, ocr_items in zip(images, ocr_data):
        w, h = img.size
        words = []
        boxes = []
        labels = []

        for item in ocr_items:
            text = str(item["text"]).strip()
            if not text:
                continue
            lbl = str(item.get("label", "other")).lower()
            box = item.get("box", [])
            if len(box) < 4:
                continue
            norm_box = normalize_bbox(box, w, h)

            token_words = text.split()
            for i, word in enumerate(token_words):
                words.append(word)
                boxes.append(norm_box)
                if lbl in ["company", "address", "date", "total"]:
                    prefix = "B-" if i == 0 else "I-"
                    tag = f"{prefix}{lbl.upper()}"
                    labels.append(label_to_id.get(tag, 0))
                else:
                    labels.append(label_to_id["O"])

        all_words.append(words[:512])
        all_boxes.append(boxes[:512])
        all_labels.append(labels[:512])

    encoding = processor(
        images=images,
        text=all_words,
        boxes=all_boxes,
        word_labels=all_labels,
        truncation=True,
        padding="max_length",
        max_length=512
    )
    return encoding

print("Processing dataset into LayoutLM tensor format...")
# Split dataset 90% train, 10% validation
split_ds = raw_dataset["train"].train_test_split(test_size=0.1, seed=42)
train_dataset = split_ds["train"].map(preprocess_function, batched=True, batch_size=4, remove_columns=raw_dataset["train"].column_names)
val_dataset = split_ds["test"].map(preprocess_function, batched=True, batch_size=4, remove_columns=raw_dataset["train"].column_names)

# Step 4: Initialize LayoutLMv3 Model & Train
print("\n🧠 Step 4/5: Loading LayoutLMv3 neural model...")
model = AutoModelForTokenClassification.from_pretrained(
    "microsoft/layoutlmv3-base",
    num_labels=len(label_list),
    id2label=id_to_label,
    label2id=label_to_id
)

training_args = TrainingArguments(
    output_dir="./results",
    learning_rate=2e-5,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    num_train_epochs=5,
    weight_decay=0.01,
    logging_steps=20,
    eval_strategy="epoch",
    save_strategy="epoch",
    save_total_limit=1,
    load_best_model_at_end=True,
    report_to="none",
    fp16=torch.cuda.is_available()  # 16-bit mixed precision on GPU for 2x faster training
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    data_collator=default_data_collator,
)

print("\n🚀 Starting Model Fine-Tuning (~10-15 minutes on GPU)...")
trainer.train()

# Step 5: Save & Download Trained Model
print("\n💾 Step 5/5: Exporting trained weights...")
output_dir = "./custom_model"
model.save_pretrained(output_dir)
processor.save_pretrained(output_dir)
print(f"Model saved successfully to {output_dir}")

# Create ZIP archive
shutil.make_archive("custom_model", "zip", output_dir)
print("📦 Created custom_model.zip archive!")

# Trigger Google Colab Auto-Download
try:
    from google.colab import files
    print("⬇️ Triggering browser download of custom_model.zip...")
    files.download("custom_model.zip")
    print("✅ Download started! Save this file to your computer.")
except Exception:
    print("ℹ️ Script finished. You can download 'custom_model.zip' from Colab's left sidebar Files tab.")
