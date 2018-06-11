# Compilation guide

This is a guide for installing the required dependencies to modify the WildBeast documentation and compile it for your pull request.

**Note:** Windows users can use the bundled Batch file (**install_docs_deps.bat**) to easily install the dependencies. The installation process is far simpler on Linux and can be done by simply running `sudo python3.5 -m pip --upgrade -r requirements.txt`. (3.6 is also supported)

## Initial setup

When you have cloned the repository, you need to install the dependencies before making modifications.

These dependencies will use Python to install, and your Python installation has to comply with requirements for the MkDocs documentation generator engine. If you haven't set it up yet on your system, follow [MkDocs' guide](http://www.mkdocs.org/#installing-python) on doing so.

Remember to install the dependencies for the documentation as outlined above.

## Editing

Before you start making changes to the documents, open a command window in the repository folder and run the command `npm run start-docs`. This will start the MkDocs test server.

When the test environment is running, you can open the URL `http://localhost:8000` in your browser to preview your changes. Every time you save a document, the page will automatically refresh and display changes.

**Note:** If you add new pages, you need to add the page name and document into `mkdocs.yml` in the sitemap section or the page will not be added to the navbar. **New pages must always be added to the navbar!**
