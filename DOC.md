
Frappe Framework not only provides a rich admin interface via the
[Desk](/framework/v14/user/en/desk) which is an SPA but also static server rendered web
pages. These pages are generally built for your website visitors. They can be
public or can require login.

## Adding pages

Every frappe app including frappe comes with a `www` folder which directly maps
to website urls. Here is what the directory structure looks like:

```bash
frappe/www
├── about.html
├── about.py
├── contact.html
├── contact.py
├── desk.html
├── desk.py
├── login.html
├── login.py
├── me.html
└── me.py
```

This structure enables the routes `/about`, `/contact`, `/desk`, `/login` and
`/me`.

To add your own page, just add an HTML file in the `www` folder of your app.
There are multiple ways to organize these portal pages. For example,

```bash
custom_app/www
├── custom_page.html
└── custom_page.py
```
Will be rendered on the route `/custom_page`.

To add subpages you can convert your main page into a folder and add its content
in an index file. For example,

```bash
custom_app/www
└── custom_page
 ├── index.html
 ├── index.py
 ├── subpage.html
 └── subpage.py

```
Will still be rendered on the route `/custom_page` and `/custom_page/subpage`
will also be available.

> You can write `.md` files instead of `.html` for simple static pages like
> documentation. This documentation you are reading is written as a markdown file.

### Overriding standard pages

Frappe also allows you to override standard pages through your custom app. For
example, to override the standard `/about` provided by frappe, just add a file
named `about.html` in the `www` folder of your app and it will take precedence.

### Templating

You can add dynamic content to Portal Pages using Jinja templates. All of the
portal pages extend from the base template `frappe/templates/web.html` which
itself extends from `frappe/templates/base.html`.

Here is what a sample page might look like:

```html

{% extends "templates/web.html" %}

{% block title %}{{ _("About Us") }}{% endblock %}

{% block page_content %}
{{ _("About Us") }}
====================




 We believe that great companies are driven by excellence,
 and add value to both its customers and society.
 You will find our team embibes these values.
 

{% endblock %}
```

You can also omit the `extend` and `block` if you want to the use the default
base template.

```html

{{ _("About Us") }}
====================




 We believe that great companies are driven by excellence,
 and add value to both its customers and society.
 You will find our team embibes these values.
 

```

### Context

Every portal page can have a python controller which will build `context` for
the page. The controller should have the same name as the `.html` or `.md` file
with a `.py` extension.

```bash
custom_app/www
├── custom_page.html
└── custom_page.py
```

The controller should have a `get_context` method which takes a `context` dict,
adds any data to it and then returns it. Here is what a sample page controller
might look like:

```py
# about.py
import frappe

def get_context(context):
 context.about_us_settings = frappe.get_doc('About Us Settings')
 return context
```

Usage in template


```html

{{ _("About Us") }}
====================




 We believe that great companies are driven by excellence,
 and add value to both its customers and society.
 You will find our team embibes these values.
 

 {% if about_us_settings.show_contact_us %}
 [Contact Us](/contact)
 {% endif %}

```


> Since Portal Pages are built using Jinja, frappe provides a standard
> [API](/framework/v14/user/en/api/jinja) to use in jinja templates.

#### List of standard context keys

Here is a list of all the standard keys that can be set in `context` and their
functionalities.

| Context Key | Functionality |
| --------------------- | ---------------------------------------- |
| `add_breadcrumbs` | Add breadcrumbs to page |
| `no_breadcrumbs` | Remove breadcrumbs from page |
| `show_sidebar` | Show web sidebar |
| `safe_render` | Toggle [safe_render](#safe_render) |
| `no_header` | Hide header |
| `no_cache` | Disable caching for this page |
| `sitemap` | Include/exclude page in sitemap |
| `add_next_prev_links` | Add Next and Previous navigation buttons |
| `title` | Set the page title |

##### safe_render

`frappe.render_template` does not render a template which contains the string
`.__` to prevent running any illegal python expressions. You may want to disable
this behaviour if you are sure that the content is safe. To do this, you need to
turn off safe render by setting the value of `safe_render` key to `False` in
context.

#### Set context via frontmatter

You can also set values in context using a frontmatter block. Frontmatter blocks
can be used to set static values specific to a page like meta tags.

Take a look at the following example:
```bash
---
title: Introduction
metatags:
 description: This is description for the introduction page
---

# Introduction
This is an introduction page
```

The above frontmatter block will update the `context` dict with the following values:
```py
{
 'title': 'Introduction',
 'metatags': {
 'description': 'This is description for the introduction page'
 }
}
```

#### Set context via comments

You can also set some values in context by adding html comments in your pages.

For example by adding `` to your `.html` or `.md` file,
`context.add_breadcrumbs` will be set to `True` and it will automatically generate
breadcrumbs based on folder structure.


```html

{{ _("About Us") }}
====================




 We believe that great companies are driven by excellence,
 and add value to both its customers and society.
 You will find our team embibes these values.
 

 {% if about_us_settings.show_contact_us %}
 [Contact Us](/contact)
 {% endif %}

```

Here is a list of keys that you can set and their context values:

| Comment | Context Value |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| `` | `add_breadcrumbs = 1` |
| `` | `no_breadcrumbs = 1` |
| `` | `show_sidebar = 1` |
| `` | `no_header = 1` |
| `` | `no_cache = 1` |
| `` | `sitemap = 0` |
| `` | `sitemap = 1` |
| `` | `add_next_prev_links = 1` |
| `` | `title = 'Custom Title'` |
| `` | `base_template = 'custom_app/path/to/custom_base.html'` |

### Custom CSS and JS

You can add custom CSS and JS for your pages by dropping a `.css` or `.js` file
of the same name.

```bash
custom_app/www
├── custom_page.html
├── custom_page.css
├── custom_page.js
└── custom_page.py
```

### Home Page

The home page for your portal can be defined in

1. Role
1. Portal Settings (this will be for logged in users)
1. Via Hook `get_website_user_home_page`
1. Website Settings (this will be for non logged in users as well - i.e. Guest)

Workspace is the first page you land on when you log in.
It also has a dedicated sidebar where you can rearrange the workspace position according to your convenience.

The workspace itself is a tool to build user-specific pages. 
It comes with some standard workspaces which are listed in the `PUBLIC` section in the sidebar and are visible to all users.
You can also create private workspaces which will only be visible to the logged-in user(owner) in the `MY WORKSPACES` section. 

Let's build one and check out some cool features.

###Create New Workspace
1. Click on **Create Workspace** button.
2. Enter Title and click on Create.

![Create Workspace](/files/CreateWorkspace.gif)

###Create Child Workspace
1. Click on **Create Workspace** button.
2. Enter Title.
3. Select Home in the Parent field and click on Create.

![Create Child Workspace](/files/ChildPage.gif)

###Workspace Blocks
The workspace block is a building block for the workspace page.
These blocks can be placed in different variations to build an ideal workspace for a specific use case.

[Learn More →](/framework/v14/user/en/desk/workspace/blocks)

![Workspace Blocks](/files/WorkspaceBlocks.gif)
###Sidebar


![Workspace Sidebar](/files/WorkspaceSidebar.png)


There are two sections in the sidebar `MY WORKSPACES` & `PUBLIC`.


You can create as many private workspaces as you want.
It will only be visible to the currently logged-in user(owner) under the `MY WORKSPACES` section


All the standard workspaces comes under `PUBLIC` section. 
You can also create more public workspaces. These workspaces will be visible to all users.
 


[More →](/framework/v14/user/en/desk/workspace/customization#customizing-workspaces) 



>Only users with **Workspace Manager Role** can create, edit or delete public workspaces

###Customization
Workspace has two modes **Read Only Mode** and **Edit Mode**. You can start customizing your workspace by clicking on the **Edit** button.
[Customizing Workspaces](/framework/v14/user/en/desk/workspace/customization#customizing-workspaces) and [Customizing Workspace Page](/framework/v14/user/en/desk/workspace/customization#customizing-workspace-page) are two different things.

>Adding new blocks from the workspace document will not work as the new workspace doesn't know exactly where to add that block (at which position). You can update the existing blocks from the workspace document but it is not recommended either. The best practice would be to use the new workspace builder UI to do all kinds of customization.

Workspaces can be restricted based on Modules and Roles.

### Modules

Users can have access to different modules and standard workspaces are visible based on access to those modules.

In the below GIF you can see when Website Module access was removed for user John Doe, he was not able to see Website Workspace. ![Module Access](/files/ModuleAccess.gif)  


### Roles

Users can have access to modules but what if you still want those users to not see the standard workspace of that module. Then you can restrict access based on the roles given to that user.

Check below Example:

Jack Doe is a manager with Workspace Manager Role. He only wants user with Website Manager Role to see the Website Workspace.ence such a configuration is made as follows: ![Role Access 1](/files/RoleAccess1.gif)  


To test this, Jane Doe is given the Website Module access and not given the Website Manager role. Due to the configuration done above, she will not be able to see Website Workspace as shown below. Where as John Doe who has Website Module access and Website Manager role, will be able to see the Website Workspace. ![Role Access 2](/files/RoleAccess2.gif)  


### Default Workspace

The default workspace that will be shown when the user first logs in can be configured for each user. By default, the user will be shown the workspace they were last in. The default workspace can be selected using the "Default Workspace" field of the User settings form, that can be accessed through the "My Settings" option of your avatar menu.


You can make your website by adding pages to the `/www` folder of your website. The urls of your site will match the path of your pages within the `/www` folder.

Pages must be `.html` or `.md` (Markdown) files. Basic HTML template is provided in frappe in `frappe/templates/base_template.html`

You can defining the ordering of pages in index by defining the index.txt file in your folder. The index.txt file must have the names (without extensions) of the pages in that folder indicating the order.

For example for this folder the `index.txt` looks like:

 adding-pages
 ordering
 contents
 context
 building



To add pages, just add `.html` or `.md` files in the `www` folder. The pages must only have the content, not the `` and `` tags.

You can also write markdown pages

### Index

The first file in a folder must be called `index.md` or `index.html`

Either file must be present for the system to make this a valid folder to build pages.

### Markdown

 # This is a title

 This is some page content
 a [link](/link/to/page)

### Adding Links

Links urls to pages can be given without the `.html` extension for example `/home/link`

### Title

The first `` block if present will be the page title if not specified in a special tag. If no `
====================================================================================

` or title is specified, the file name will be the title.

### Adding CSS

You can also add a `.css` file with the same filename (e.g. `index.css` for `index.md`) that will be rendered with the page.

### Special Tags

1. `` will make the page render in Jinja
2. `` will add a custom title
3. `` will not add breadcrumbs in the page
4. `` will enable caching (if you have used Jinja templating)
==========================================================================================================================================================================================================================================================================================================================================================================================================

