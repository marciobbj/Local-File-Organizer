#!/usr/bin/env python3
"""
CLI version of the file organizer for use with Electron UI
"""

import os
import sys
import json
import argparse
import platform
from pathlib import Path
from PIL import Image
import torch
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM,
    AutoProcessor,
    AutoModelForImageTextToText
)

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

from file_type_config import file_type_manager, FileCategory

def detect_operating_system():
    """Detect the current operating system."""
    system = platform.system().lower()
    if system == 'darwin':
        return 'macos'
    elif system == 'windows':
        return 'windows'
    elif system == 'linux':
        return 'linux'
    else:
        return 'unknown'

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
            image_processor = AutoProcessor.from_pretrained(model_name, use_fast=True)
            image_model = AutoModelForImageTextToText.from_pretrained(model_name)
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
            
            # Get file type rule from the manager
            rule = file_type_manager.get_rule_for_extension(file_ext)
            
            if rule:
                # Use the rule to determine category and description
                category = rule.category.value
                description = rule.description
                
                # Handle AI analysis if required
                if rule.requires_ai_analysis:
                    if rule.ai_model_type == 'text':
                        try:
                            with open(file_path, 'r', encoding='utf-8') as file:
                                content = file.read()
                            description = analyze_text_with_ai(content, text_model, text_tokenizer)
                        except:
                            description = rule.description
                    elif rule.ai_model_type == 'image':
                        description = analyze_image_with_ai(file_path, image_model, image_processor)
            else:
                # Default fallback for unknown extensions
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

def simulate_directory_tree(operations, output_path, ignored_folders=None):
    """Simulate the directory tree that would be created."""
    tree = {}
    
    for op in operations:
        op_type = op.get('type', 'move')
        
        if op_type in ['move', 'hardlink', 'symlink']:
            dest_path = op['destination']
            source_path = op['source']
            rel_path = os.path.relpath(dest_path, output_path)
            dir_path = os.path.dirname(rel_path)
            
            if dir_path not in tree:
                tree[dir_path] = []
            
            # Include file info with size
            file_info = {
                'name': os.path.basename(dest_path),
                'source': source_path
            }
            
            # Get file size from original file
            try:
                if os.path.exists(source_path):
                    file_info['size'] = os.path.getsize(source_path)
                    file_info['modified'] = os.path.getmtime(source_path)
                else:
                    file_info['size'] = 0
            except OSError:
                file_info['size'] = 0
                
            tree[dir_path].append(file_info)
    
    # Add ignored folders to the tree
    if ignored_folders:
        for folder_path in ignored_folders:
            folder_name = os.path.basename(folder_path)
            # Create a special entry for ignored folders
            ignored_folder_info = {
                'name': folder_name,
                'source': folder_path,
                'type': 'ignored_folder',
                'size': 0  # We don't calculate size for ignored folders
            }
            
            # Add to root level
            if '.' not in tree:
                tree['.'] = []
            tree['.'].append(ignored_folder_info)
    
    return tree

def print_simulated_tree(tree):
    """Print the simulated directory tree."""
    for directory, files in sorted(tree.items()):
        if directory == '.':
            print("Root directory:")
        else:
            print(f"{directory}/:")
        
        for file_info in sorted(files, key=lambda x: x['name'] if isinstance(x, dict) else x):
            if isinstance(file_info, dict):
                if file_info.get('type') == 'ignored_folder':
                    print(f"  {file_info['name']}/ (ignored - will be moved as-is)")
                else:
                    print(f"  {file_info['name']}")
            else:
                print(f"  {file_info}")

def main():
    parser = argparse.ArgumentParser(description='File Organizer CLI')
    parser.add_argument('--input', required=True, help='Input directory path')
    parser.add_argument('--output', required=True, help='Output directory path')
    parser.add_argument('--mode', required=True, choices=['ai_content', 'date', 'type'], help='Organization mode')
    parser.add_argument('--dry-run', type=str, default='true', help='Dry run mode (true/false)')
    parser.add_argument('--json-output', action='store_true', help='Output results as JSON')
    parser.add_argument('--recursive', type=str, default='true', help='Recursive search (true/false)')
    
    args = parser.parse_args()
    
    # Ensure NLTK data is downloaded
    ensure_nltk_data()
    
    # Validate paths
    if not os.path.exists(args.input):
        print(f"Error: Input path '{args.input}' does not exist", file=sys.stderr)
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output, exist_ok=True)
    
    # Collect file paths with recursive option
    recursive = args.recursive.lower() == 'true'
    file_paths, ignored_folders = collect_file_paths(args.input, recursive=recursive)
    
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
        tree = simulate_directory_tree(operations, args.output, ignored_folders)
        
        # Detect operating system
        detected_os = detect_operating_system()
        
        # Convert to UI-compatible format
        ui_tree = {
            'name': '',
            'type': 'folder',
            'os': detected_os,
            'children': []
        }
        
        for directory, files in tree.items():
            if directory == '.':
                # Root level files and ignored folders
                for file_info in files:
                    if isinstance(file_info, dict):
                        if file_info.get('type') == 'ignored_folder':
                            # Add ignored folder as a special folder type
                            ui_tree['children'].append({
                                'name': file_info['name'],
                                'type': 'ignored_folder',
                                'os': detected_os,
                                'size': 0,
                                'source': file_info.get('source')
                            })
                        else:
                            # Regular file
                            ui_tree['children'].append({
                                'name': file_info['name'],
                                'type': 'file',
                                'os': detected_os,
                                'size': file_info.get('size', 0),
                                'modified': file_info.get('modified')
                            })
                    else:
                        # Backward compatibility for old format
                        ui_tree['children'].append({
                            'name': file_info,
                            'type': 'file',
                            'os': detected_os
                        })
            else:
                # Directory
                dir_node = {
                    'name': directory,
                    'type': 'folder',
                    'os': detected_os,
                    'children': []
                }
                
                for file_info in files:
                    if isinstance(file_info, dict):
                        dir_node['children'].append({
                            'name': file_info['name'],
                            'type': 'file',
                            'os': detected_os,
                            'size': file_info.get('size', 0),
                            'modified': file_info.get('modified')
                        })
                    else:
                        # Backward compatibility for old format
                        dir_node['children'].append({
                            'name': file_info,
                            'type': 'file',
                            'os': detected_os
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
