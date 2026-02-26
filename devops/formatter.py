"""
Custom formatter
Returns:
    None: 
"""
import logging

class CustomFormatter(logging.Formatter):
    """Custom logger formatter

    Args:
        logging (obj): Base Formatter class

    Returns:
        str: Formatted string
    """

    grey = "\x1b[38;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    lightblue = "\x1b[38;5;39m"
    orange = "\x1b[38;5;178"
    format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s (%(filename)s:%(lineno)d)"

    FORMATS = {
        logging.DEBUG: yellow + format + reset,
        logging.INFO: lightblue + format + reset,
        logging.WARNING: orange + format + reset,
        logging.ERROR: red + format + reset,
        logging.CRITICAL: bold_red + format + reset
    }

    def format(self, record):
        """Format log

        Args:
            record (str): Record str

        Returns:
            str: format
        """
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)