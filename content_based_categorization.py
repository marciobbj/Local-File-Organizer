#!/usr/bin/env python3
"""
AI-Powered Content-Based Categorization System
Uses AI to intelligently categorize files based on their content
"""

import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

# Optional torch import for AI functionality
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

class AICategorizer:
    """AI-powered categorizer that determines file categories based on content"""
    
    def __init__(self):
        # Define the main category structure for AI to use
        self.category_structure = """
        Main Categories:
        1. Code/
           - Python/ (Python scripts, modules, packages)
           - JavaScript/ (JS files, Node.js, web scripts)
           - Web/ (HTML, CSS, web frameworks)
           - Database/ (SQL, NoSQL, schemas)
           - Configuration/ (config files, settings)
           - Other/ (other programming languages)
        
        2. Documents/
           - Technical/ (API docs, technical specs, manuals)
           - Business/ (reports, plans, contracts, financial)
           - Academic/ (research papers, theses, studies)
           - Personal/ (notes, diaries, personal docs)
           - Legal/ (legal documents, contracts, policies)
           - Creative/ (stories, scripts, creative writing)
        
        3. Data/
           - Financial/ (budgets, invoices, financial reports)
           - Scientific/ (research data, experiments, analysis)
           - User/ (user data, profiles, preferences)
           - Analytics/ (business intelligence, metrics, KPIs)
           - Database/ (data exports, backups, dumps)
        
        4. Images/
           - Personal Photos/ (family, friends, personal)
           - Professional/ (work-related, business)
           - Graphics/ (designs, logos, illustrations)
           - Screenshots/ (system, application, web)
           - Art/ (creative, artistic, drawings)
        
        5. Media/
           - Audio/ (music, podcasts, voice recordings)
           - Video/ (movies, tutorials, presentations)
           - Entertainment/ (games, entertainment content)
        
        6. Archives/
           - Software/ (installers, packages)
           - Documents/ (document collections)
           - Media/ (media collections)
           - Backups/ (system backups, data backups)
        
        7. Applications/
           - Windows/ (Windows executables)
           - macOS/ (macOS applications)
           - Linux/ (Linux applications)
           - Mobile/ (mobile apps, APKs)
        
        8. System/
           - Configuration/ (system configs)
           - Logs/ (system logs, application logs)
           - Temporary/ (temp files, cache)
           - Security/ (certificates, keys)
        """
    
    def create_ai_prompt(self, content: str, file_path: str, ai_description: str) -> str:
        """Create an AI prompt for intelligent categorization"""
        
        prompt = f"""
        Analyze this file and categorize it intelligently based on its content.
        
        File Path: {file_path}
        AI Description: {ai_description}
        
        {self.category_structure}
        
        Instructions:
        1. Analyze the content and AI description carefully
        2. Choose the most appropriate category and subcategory
        3. Provide a detailed explanation of why this category was chosen
        4. Suggest additional tags or metadata if relevant
        5. Return the result in this exact format:
        
        CATEGORY: [Main Category]/[Subcategory]
        REASON: [Detailed explanation]
        TAGS: [comma-separated tags]
        CONFIDENCE: [0.0-1.0]
        
        File Content Preview:
        {content[:1000]}...
        
        Please analyze and categorize this file:
        """
        
        return prompt
    
    def parse_ai_response(self, ai_response: str) -> Tuple[str, str, List[str], float]:
        """Parse the AI response to extract categorization information"""
        
        try:
            lines = ai_response.strip().split('\n')
            category = "Other"
            reason = "AI analysis provided"
            tags = []
            confidence = 0.7
            
            for line in lines:
                line = line.strip()
                if line.startswith('CATEGORY:'):
                    category = line.replace('CATEGORY:', '').strip()
                elif line.startswith('REASON:'):
                    reason = line.replace('REASON:', '').strip()
                elif line.startswith('TAGS:'):
                    tags_str = line.replace('TAGS:', '').strip()
                    tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
                elif line.startswith('CONFIDENCE:'):
                    conf_str = line.replace('CONFIDENCE:', '').strip()
                    try:
                        confidence = float(conf_str)
                    except ValueError:
                        confidence = 0.7
            
            return category, reason, tags, confidence
            
        except Exception as e:
            # Fallback if AI response parsing fails
            return "Other", f"AI analysis failed: {str(e)}", [], 0.5
    
    def categorize_with_ai(self, 
                          file_path: str, 
                          content: str, 
                          ai_description: str,
                          text_model,
                          text_tokenizer) -> Tuple[str, str, List[str], float]:
        """
        Use AI to categorize file based on content
        
        Returns:
            - category: AI-determined category
            - description: Enhanced description with reasoning
            - tags: Suggested tags
            - confidence: AI confidence level
        """
        
        try:
            # Create AI prompt for categorization
            prompt = self.create_ai_prompt(content, file_path, ai_description)
            
            # Get AI response for categorization
            ai_response = self._get_ai_categorization(prompt, text_model, text_tokenizer)
            
            # Parse AI response
            category, reason, tags, confidence = self.parse_ai_response(ai_response)
            
            # Create enhanced description
            enhanced_description = f"{ai_description} | {reason}"
            
            return category, enhanced_description, tags, confidence
            
        except Exception as e:
            # Fallback to extension-based categorization instead of "Other"
            # This ensures we don't lose the original category when AI fails
            return "EXTENSION_BASED", f"{ai_description} (AI categorization failed: {str(e)})", [], 0.5
    
    def _get_ai_categorization(self, prompt: str, text_model, text_tokenizer) -> str:
        """Get AI response for categorization"""
        
        if not TORCH_AVAILABLE:
            return """
            CATEGORY: EXTENSION_BASED
            REASON: Torch not available for AI analysis
            TAGS: torch-missing, ai-unavailable
            CONFIDENCE: 0.0
            """
        
        try:
            # Encode the prompt
            inputs = text_tokenizer.encode(prompt, return_tensors="pt", truncation=True, max_length=1000)
            
            # Generate response
            with torch.no_grad():
                outputs = text_model.generate(
                    inputs,
                    max_length=500,
                    num_return_sequences=1,
                    temperature=0.3,  # Lower temperature for more focused responses
                    do_sample=True,
                    pad_token_id=text_tokenizer.eos_token_id
                )
            
            response = text_tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract only the response part (remove the prompt)
            if 'CATEGORY:' in response:
                response_parts = response.split('CATEGORY:')
                if len(response_parts) > 1:
                    return 'CATEGORY:' + response_parts[1]
            
            return response
            
        except Exception as e:
            # Fallback response if AI generation fails
            return f"""
            CATEGORY: EXTENSION_BASED
            REASON: AI analysis failed due to technical error: {str(e)}
            TAGS: error, ai-failed
            CONFIDENCE: 0.5
            """

def categorize_by_content(file_path: str, 
                         content: str, 
                         ai_description: str,
                         extension_category: str,
                         text_model,
                         text_tokenizer) -> Tuple[str, str, List[str], float]:
    """
    AI-powered file categorization based on content
    
    Returns:
        - final_category: AI-determined category
        - description: Enhanced description with AI reasoning
        - tags: AI-suggested tags
        - confidence: AI confidence level
    """
    
    categorizer = AICategorizer()
    
    # Use AI for categorization
    category, description, tags, confidence = categorizer.categorize_with_ai(
        file_path, content, ai_description, text_model, text_tokenizer
    )
    
    # If AI categorization failed, fall back to extension-based category
    if category == "EXTENSION_BASED":
        return extension_category, description, tags, confidence
    
    return category, description, tags, confidence

# Example usage
if __name__ == "__main__":
    print("AI-Powered Content Categorization System")
    print("This system requires AI models to be loaded for testing.")
    print("Use it within the main application where models are available.")
