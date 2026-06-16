from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

from alaiy_os_core import __version__ as version

setup(
	name="alaiy_os_core",
	version=version,
	description="AlaiyOS Core — connector registry and branding layer",
	author="Alaiy",
	author_email="sarthak@alaiy.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires,
)
