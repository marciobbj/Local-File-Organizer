#!/usr/bin/env python3
"""
File Type Configuration Module
Centralized configuration for file types, categories, and processing rules
"""

from typing import Dict, List, Tuple, Optional, Callable
from dataclasses import dataclass
from enum import Enum

class FileCategory(Enum):
    """Enumeration of file categories"""
    CODE = "Code"
    DATA = "Data"
    CONFIGURATION = "Configuration"
    DOCUMENTS = "Documents"
    IMAGES = "Images"
    VIDEOS = "Videos"
    AUDIO = "Audio"
    ARCHIVES = "Archives"
    IWORK = "iWork"
    DESIGN = "Design"
    APPLICATIONS = "Applications"
    VIRTUAL_MACHINES = "Virtual Machines"
    SYSTEM_FILES = "System Files"
    FONTS = "Fonts"
    OTHER = "Other"

@dataclass
class FileTypeRule:
    """Configuration for a file type rule"""
    extensions: List[str]
    category: FileCategory
    description: str
    requires_ai_analysis: bool = False
    ai_model_type: Optional[str] = None  # 'text', 'image', or None
    custom_processor: Optional[Callable] = None
    priority: int = 0  # Higher priority rules are checked first

class FileTypeManager:
    """Centralized manager for file type configurations"""
    
    def __init__(self):
        self._rules: List[FileTypeRule] = []
        self._initialize_default_rules()
    
    def _initialize_default_rules(self):
        """Initialize default file type rules"""
        
        # Text files with AI analysis
        self.add_rule(FileTypeRule(
            extensions=['.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.csv', '.log', '.ini', '.conf', '.cfg', '.yml', '.yaml'],
            category=FileCategory.DOCUMENTS,
            description="Text document",
            requires_ai_analysis=True,
            ai_model_type='text',
            priority=100
        ))
        
        # Image files with AI analysis
        self.add_rule(FileTypeRule(
            extensions=['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.svg', '.webp', '.heic', '.heif', '.raw', '.cr2', '.nef', '.arw'],
            category=FileCategory.IMAGES,
            description="Image file",
            requires_ai_analysis=True,
            ai_model_type='image',
            priority=100
        ))
        
        # Video files
        self.add_rule(FileTypeRule(
            extensions=['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp', '.ogv', '.ts'],
            category=FileCategory.VIDEOS,
            description="Video file",
            priority=90
        ))
        
        # Audio files
        self.add_rule(FileTypeRule(
            extensions=['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.aiff', '.alac', '.opus'],
            category=FileCategory.AUDIO,
            description="Audio file",
            priority=90
        ))
        
        # Archive files
        self.add_rule(FileTypeRule(
            extensions=['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.lzma', '.dmg', '.pkg'],
            category=FileCategory.ARCHIVES,
            description="Archive file",
            priority=80
        ))
        
        # Document files
        self.add_rule(FileTypeRule(
            extensions=['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.rtf', '.odt', '.odp', '.ods'],
            category=FileCategory.DOCUMENTS,
            description="Document file",
            priority=85
        ))
        
        # macOS iWork files
        self.add_rule(FileTypeRule(
            extensions=['.pages', '.numbers', '.keynote'],
            category=FileCategory.IWORK,
            description="iWork document",
            priority=85
        ))
        
        # Design and creative files
        self.add_rule(FileTypeRule(
            extensions=['.psd', '.ai', '.eps', '.indd', '.sketch', '.fig', '.xd', '.afdesign'],
            category=FileCategory.DESIGN,
            description="Design file",
            priority=80
        ))
        
        # Database and data files
        self.add_rule(FileTypeRule(
            extensions=['.db', '.sqlite', '.sql', '.mdb', '.accdb', '.tsv', '.parquet'],
            category=FileCategory.DATA,
            description="Database or data file",
            priority=75
        ))
        
        # Applications and installers
        self.add_rule(FileTypeRule(
            extensions=['.exe', '.app', '.deb', '.rpm', '.msi', '.apk'],
            category=FileCategory.APPLICATIONS,
            description="Application or installer",
            priority=70
        ))
        
        # Virtual machine and disk images
        self.add_rule(FileTypeRule(
            extensions=['.iso', '.vmdk', '.vhd', '.ova', '.ovf'],
            category=FileCategory.VIRTUAL_MACHINES,
            description="Virtual machine or disk image",
            priority=65
        ))
        
        # Backup and temporary files
        self.add_rule(FileTypeRule(
            extensions=['.bak', '.tmp', '.temp', '.cache', '.old'],
            category=FileCategory.SYSTEM_FILES,
            description="Backup or temporary file",
            priority=60
        ))
        
        # Font files
        self.add_rule(FileTypeRule(
            extensions=['.font', '.ttf', '.otf', '.woff', '.woff2', '.eot'],
            category=FileCategory.FONTS,
            description="Font file",
            priority=70
        ))
        
        # Sort rules by priority (highest first)
        self._rules.sort(key=lambda x: x.priority, reverse=True)
    
    def add_rule(self, rule: FileTypeRule):
        """Add a new file type rule"""
        self._rules.append(rule)
        # Re-sort by priority
        self._rules.sort(key=lambda x: x.priority, reverse=True)
    
    def remove_rule(self, extensions: List[str]):
        """Remove rules for specific extensions"""
        self._rules = [rule for rule in self._rules if not any(ext in rule.extensions for ext in extensions)]
    
    def get_rule_for_extension(self, extension: str) -> Optional[FileTypeRule]:
        """Get the rule for a specific file extension"""
        extension = extension.lower()
        for rule in self._rules:
            if extension in rule.extensions:
                return rule
        return None
    
    def get_all_extensions(self) -> List[str]:
        """Get all supported file extensions"""
        extensions = []
        for rule in self._rules:
            extensions.extend(rule.extensions)
        return extensions
    
    def get_extensions_by_category(self, category: FileCategory) -> List[str]:
        """Get all extensions for a specific category"""
        for rule in self._rules:
            if rule.category == category:
                return rule.extensions
        return []
    
    def get_categories(self) -> List[FileCategory]:
        """Get all available categories"""
        return list(set(rule.category for rule in self._rules))
    
    def update_rule(self, extensions: List[str], **kwargs):
        """Update an existing rule"""
        for rule in self._rules:
            if any(ext in rule.extensions for ext in extensions):
                for key, value in kwargs.items():
                    if hasattr(rule, key):
                        setattr(rule, key, value)
                break
    
    def export_config(self) -> Dict:
        """Export current configuration as dictionary"""
        config = {
            'rules': []
        }
        for rule in self._rules:
            rule_dict = {
                'extensions': rule.extensions,
                'category': rule.category.value,
                'description': rule.description,
                'requires_ai_analysis': rule.requires_ai_analysis,
                'ai_model_type': rule.ai_model_type,
                'priority': rule.priority
            }
            config['rules'].append(rule_dict)
        return config
    
    def import_config(self, config: Dict):
        """Import configuration from dictionary"""
        self._rules.clear()
        for rule_dict in config.get('rules', []):
            rule = FileTypeRule(
                extensions=rule_dict['extensions'],
                category=FileCategory(rule_dict['category']),
                description=rule_dict['description'],
                requires_ai_analysis=rule_dict.get('requires_ai_analysis', False),
                ai_model_type=rule_dict.get('ai_model_type'),
                priority=rule_dict.get('priority', 0)
            )
            self.add_rule(rule)

# Global instance
file_type_manager = FileTypeManager()

# Convenience functions for backward compatibility
def get_file_category(extension: str) -> str:
    """Get category for a file extension (backward compatibility)"""
    rule = file_type_manager.get_rule_for_extension(extension)
    return rule.category.value if rule else FileCategory.OTHER.value

def get_file_description(extension: str) -> str:
    """Get description for a file extension (backward compatibility)"""
    rule = file_type_manager.get_rule_for_extension(extension)
    return rule.description if rule else "Other file"

def is_ai_analysis_required(extension: str) -> bool:
    """Check if AI analysis is required for a file extension"""
    rule = file_type_manager.get_rule_for_extension(extension)
    return rule.requires_ai_analysis if rule else False

def get_ai_model_type(extension: str) -> Optional[str]:
    """Get AI model type for a file extension"""
    rule = file_type_manager.get_rule_for_extension(extension)
    return rule.ai_model_type if rule else None
