#!/usr/bin/env python3
"""
CLI version of the file organizer for use with Electron UI
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from file_utils import (
    display_directory_tree,
    collect_file_paths,
    separate_files_by_type,
    read_file_data
)

from data_processing_common import (
    compute_operations,
    execute_operations,
    process_files_by_date,
    process_files_by_type,
)

def ensure_nltk_data():
    """Ensure that NLTK data is downloaded efficiently and quietly."""
    try:
        import nltk
        nltk.download('stopwords', quiet=True)
        nltk.download('punkt', quiet=True)
        nltk.download('wordnet', quiet=True)
    except ImportError:
        pass  # NLTK not available

def initialize_models():
    """Initialize the AI models using Hugging Face Transformers."""
    try:
        from PIL import Image
        import torch
        from transformers import (
            AutoTokenizer, 
            AutoModelForCausalLM,
            AutoProcessor,
            AutoModelForVision2Seq
        )
        
        text_model = None
        image_model = None
        text_tokenizer = None
        image_processor = None
        
        print("Loading text model...")
        try:
            model_name = "microsoft/DialoGPT-medium"
            text_tokenizer = AutoTokenizer.from_pretrained(model_name)
            text_model = AutoModelForCausalLM.from_pretrained(model_name)
            print("✅ Text model loaded successfully!")
        except Exception as e:
            print(f"❌ Error loading text model: {e}")
            text_model = None
        
        print("Loading image model...")
        try:
            model_name = "Salesforce/blip-image-captioning-base"
            image_processor = AutoProcessor.from_pretrained(model_name)
            image_model = AutoModelForVision2Seq.from_pretrained(model_name)
            print("✅ Image model loaded successfully!")
        except Exception as e:
            print(f"❌ Error loading image model: {e}")
            image_model = None
            
        return text_model, image_model, text_tokenizer, image_processor
    except ImportError:
        print("AI models not available - using basic processing")
        return None, None, None, None

def analyze_text_with_ai(text_content, text_model, text_tokenizer, max_length=100):
    """Analyze text content using AI to generate a description."""
    if text_model is None or text_tokenizer is None:
        words = text_content.split()[:20]
        return f"Document containing: {' '.join(words)}"
    
    try:
        inputs = text_tokenizer.encode(text_content[:500], return_tensors="pt", truncation=True)
        
        with torch.no_grad():
            outputs = text_model.generate(
                inputs, 
                max_length=min(max_length, len(inputs[0]) + 50),
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True,
                pad_token_id=text_tokenizer.eos_token_id
            )
        
        response = text_tokenizer.decode(outputs[0], skip_special_tokens=True)
        return response.strip()
    except Exception as e:
        words = text_content.split()[:15]
        return f"Document: {' '.join(words)}"

def analyze_image_with_ai(image_path, image_model, image_processor, max_length=50):
    """Analyze image content using AI to generate a description."""
    if image_model is None or image_processor is None:
        return "Image file"
    
    try:
        from PIL import Image
        image = Image.open(image_path)
        inputs = image_processor(image, return_tensors="pt")
        
        with torch.no_grad():
            outputs = image_model.generate(
                **inputs,
                max_length=max_length,
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True
            )
        
        caption = image_processor.decode(outputs[0], skip_special_tokens=True)
        return caption.strip()
    except Exception as e:
        return "Image file"

def process_files_with_ai(file_paths, output_path, text_model, text_tokenizer, image_model, image_processor, silent=False):
    """Process files using AI analysis."""
    operations = []
    
    for file_path in file_paths:
        try:
            file_name = os.path.basename(file_path)
            file_ext = os.path.splitext(file_name)[1].lower()
            
            # Analyze based on file type
            if file_ext in ['.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.csv', '.log', '.ini', '.conf', '.cfg', '.yml', '.yaml']:
                # Text files
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    description = analyze_text_with_ai(content, text_model, text_tokenizer)
                except:
                    description = "Text document"
                
                # Create category based on content analysis
                if any(word in description.lower() for word in ['code', 'script', 'program', 'function', 'class', 'import']):
                    category = 'Code'
                elif any(word in description.lower() for word in ['data', 'table', 'spreadsheet', 'database', 'query']):
                    category = 'Data'
                elif any(word in description.lower() for word in ['config', 'settings', 'preferences']):
                    category = 'Configuration'
                else:
                    category = 'Documents'
                    
            elif file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp', '.heic', '.heif', '.raw', '.cr2', '.nef', '.arw']:
                # Image files
                description = analyze_image_with_ai(file_path, image_model, image_processor)
                category = 'Images'
                
            elif file_ext in ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp', '.ogv', '.ts']:
                description = "Video file"
                category = 'Videos'
                
            elif file_ext in ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.aiff', '.alac', '.opus']:
                description = "Audio file"
                category = 'Audio'
                
            elif file_ext in ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.lzma', '.dmg', '.pkg']:
                description = "Archive file"
                category = 'Archives'
                
            elif file_ext in ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.rtf', '.odt', '.odp', '.ods']:
                description = "Document file"
                category = 'Documents'
                
            elif file_ext in ['.pages', '.numbers', '.keynote']:
                # macOS iWork files
                description = "iWork document"
                category = 'iWork'
                
            elif file_ext in ['.psd', '.ai', '.eps', '.indd', '.sketch', '.fig', '.xd', '.afdesign']:
                # Design and creative files
                description = "Design file"
                category = 'Design'
                
            elif file_ext in ['.db', '.sqlite', '.sql', '.mdb', '.accdb', '.xlsx', '.csv', '.tsv', '.parquet']:
                # Database and data files
                description = "Database or data file"
                category = 'Data'
                
            elif file_ext in ['.exe', '.app', '.dmg', '.pkg', '.deb', '.rpm', '.msi', '.apk']:
                # Applications and installers
                description = "Application or installer"
                category = 'Applications'
                
            elif file_ext in ['.iso', '.vmdk', '.vhd', '.ova', '.ovf']:
                # Virtual machine and disk images
                description = "Virtual machine or disk image"
                category = 'Virtual Machines'
                
            elif file_ext in ['.bak', '.tmp', '.temp', '.cache', '.log', '.old']:
                # Backup and temporary files
                description = "Backup or temporary file"
                category = 'System Files'
                
            elif file_ext in ['.font', '.ttf', '.otf', '.woff', '.woff2', '.eot']:
                # Font files
                description = "Font file"
                category = 'Fonts'
                
            else:
                description = "Other file"
                category = 'Other'
            
            # Create destination path
            dest_dir = os.path.join(output_path, category)
            dest_path = os.path.join(dest_dir, file_name)
            
            operations.append({
                'source': file_path,
                'destination': dest_path,
                'type': 'move',
                'description': description,
                'category': category
            })
            
        except Exception as e:
            if not silent:
                print(f"Error processing {file_path}: {e}")
    
    return operations

def simulate_directory_tree(operations, output_path):
    """Simulate the directory tree that would be created."""
    tree = {}
    
    for op in operations:
        op_type = op.get('type', 'move')
        
        if op_type in ['move', 'hardlink', 'symlink']:
            dest_path = op['destination']
            rel_path = os.path.relpath(dest_path, output_path)
            dir_path = os.path.dirname(rel_path)
            
            if dir_path not in tree:
                tree[dir_path] = []
            
            tree[dir_path].append(os.path.basename(dest_path))
    
    return tree

def print_simulated_tree(tree):
    """Print the simulated directory tree."""
    for directory, files in sorted(tree.items()):
        if directory == '.':
            print("Root directory:")
        else:
            print(f"{directory}/:")
        
        for file in sorted(files):
            print(f"  {file}")

def main():
    parser = argparse.ArgumentParser(description='File Organizer CLI')
    parser.add_argument('--input', required=True, help='Input directory path')
    parser.add_argument('--output', required=True, help='Output directory path')
    parser.add_argument('--mode', required=True, choices=['ai_content', 'date', 'type'], help='Organization mode')
    parser.add_argument('--dry-run', type=str, default='true', help='Dry run mode (true/false)')
    parser.add_argument('--json-output', action='store_true', help='Output results as JSON')
    
    args = parser.parse_args()
    
    # Ensure NLTK data is downloaded
    ensure_nltk_data()
    
    # Validate paths
    if not os.path.exists(args.input):
        print(f"Error: Input path '{args.input}' does not exist", file=sys.stderr)
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output, exist_ok=True)
    
    # Collect file paths
    file_paths = collect_file_paths(args.input)
    
    if args.json_output:
        # Generate structure preview
        if args.mode == 'ai_content':
            text_model, image_model, text_tokenizer, image_processor = initialize_models()
            operations = process_files_with_ai(file_paths, args.output, text_model, text_tokenizer, image_model, image_processor, silent=True)
        elif args.mode == 'date':
            operations = process_files_by_date(file_paths, args.output, dry_run=True, silent=True)
        elif args.mode == 'type':
            operations = process_files_by_type(file_paths, args.output, dry_run=True, silent=True)
        
        # Create tree structure for UI
        tree = simulate_directory_tree(operations, args.output)
        
        # Convert to UI-compatible format
        ui_tree = {
            'name': '',
            'type': 'folder',
            'os': 'unknown',
            'children': []
        }
        
        for directory, files in tree.items():
            if directory == '.':
                # Root level files
                for file in files:
                    ui_tree['children'].append({
                        'name': file,
                        'type': 'file',
                        'os': 'unknown'
                    })
            else:
                # Directory
                dir_node = {
                    'name': directory,
                    'type': 'folder',
                    'os': 'unknown',
                    'children': []
                }
                
                for file in files:
                    dir_node['children'].append({
                        'name': file,
                        'type': 'file',
                        'os': 'unknown'
                    })
                
                ui_tree['children'].append(dir_node)
        
        # Output JSON for UI
        result = {
            'success': True,
            'tree': ui_tree,
            'message': f'Structure preview generated for {args.mode} mode'
        }
        
        print(json.dumps(result))
        return
    
    # Regular execution mode
    dry_run = args.dry_run.lower() == 'true'
    
    if args.mode == 'ai_content':
        print("Initializing AI models...")
        text_model, image_model, text_tokenizer, image_processor = initialize_models()
        
        print("Processing files with AI...")
        operations = process_files_with_ai(file_paths, args.output, text_model, text_tokenizer, image_model, image_processor)
        
    elif args.mode == 'date':
        print("Processing files by date...")
        operations = process_files_by_date(file_paths, args.output, dry_run=dry_run)
        
    elif args.mode == 'type':
        print("Processing files by type...")
        operations = process_files_by_type(file_paths, args.output, dry_run=dry_run)
    
    # Show proposed structure
    print("Proposed directory structure:")
    tree = simulate_directory_tree(operations, args.output)
    print_simulated_tree(tree)
    
    if not dry_run:
        print("Executing operations...")
        execute_operations(operations, dry_run=False, silent=True)
        print("Files organized successfully!")
    else:
        print("Dry run completed. No files were moved.")

if __name__ == '__main__':
    main()
