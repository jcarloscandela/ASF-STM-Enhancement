import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(REPO_ROOT, 'dist')
SRC_DIR = os.path.join(REPO_ROOT, 'src')
TEMPLATES_DIR = os.path.join(SRC_DIR, 'templates')
LIB_DIR = os.path.join(SRC_DIR, 'lib')

USERSCRIPT_FILE = os.path.join(SRC_DIR, 'ASF-STM.js')
TRADABLE_LIB_FILE = os.path.join(LIB_DIR, 'tradable.js')
TRADABLE_LIB_PLACEHOLDER = '{{TRADABLE_LIB}}'
RELEASE_FILE = os.path.join(DIST_DIR, 'ASF-STM.user.js')
DEBUG_FILE = os.path.join(DIST_DIR, 'ASF-STM.debug.js')

# Transform placeholder from camelCase to SCREAMING_SNAKE_CASE
def screaming_snake_to_camel(string):
    snake_case = re.sub(r'([a-z])([A-Z])', r'\1_\2', string)
    return snake_case.upper()

# Minifies template literals containing HTML by removing tabs and newlines
# Also removes /* HTML */ comment and enclosing backticks used for syntax highlighting
def minify_js_html_template(content):
    content = re.sub(r'(\r|\n|( {4})|`|\/\* HTML \*\/)', '', content)
    content = re.sub(r' {2,}', ' ', content)
    return content

# Modified version of CSS minifier by Borgar
# https://stackoverflow.com/a/223689/5853386 (Accessed on 2024-12-27)
def minify_css(css):
    rules = []

    # remove comments - this will break a lot of hacks :-P
    css = re.sub(r'\s*/\*\s*\*/', '$$HACK1$$', css) # preserve IE<6 comment hack
    css = re.sub(r'/\*[\s\S]*?\*/', '', css)
    css = css.replace('$$HACK1$$', '/**/') # preserve IE<6 comment hack

    # url() doesn't need quotes
    css = re.sub(r'url\((["\'])([^)]*)\1\)', r'url(\2)', css)

    # spaces may be safely collapsed as generated content will collapse them anyway
    css = re.sub(r'\s+', ' ', css )

    # shorten collapsable colors: #aabbcc to #abc
    css = re.sub(r'#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3(\s|;)', r'#\1\2\3\4', css)

    # fragment values can loose zeros
    css = re.sub(r':\s*0(\.\d+([cm]m|e[mx]|in|p[ctx]))\s*;', r':\1;', css)

    for rule in re.findall(r'([^{]+){([^}]*)}', css):

        # we don't need spaces around operators
        selectors = [re.sub(r'(?<=[\[\(>+=])\s+|\s+(?=[=~^$*|>+\]\)])', r'', selector.strip()) for selector in rule[0].split(',')]

        # order is important, but we still want to discard repetitions
        properties = {}
        porder = []
        for prop in re.findall('(.*?):(.*?)(;|$)', rule[1]):
            key = prop[0].strip().lower()
            if key not in porder: porder.append(key)
            properties[key] = prop[1].strip()

        # output rule if it contains any declarations
        if properties:
            rules.append('%s{%s}' % (','.join(selectors), ''.join(['%s:%s;' % (key, properties[key]) for key in porder])[:-1]))
    return ''.join(rules)

def fail(message):
    print(f'build failed: {message}', file=sys.stderr)
    sys.exit(1)

def read_file(path):
    try:
        with open(path, 'r', encoding='utf8') as f:
            return f.read()
    except FileNotFoundError:
        fail(f'missing required file: {os.path.relpath(path, REPO_ROOT)}')
    except OSError as error:
        fail(f'cannot read {os.path.relpath(path, REPO_ROOT)}: {error}')

def main():
    os.makedirs(DIST_DIR, exist_ok=True)

    if not os.path.isdir(TEMPLATES_DIR):
        fail(f'missing templates directory: {os.path.relpath(TEMPLATES_DIR, REPO_ROOT)}')

    script = read_file(USERSCRIPT_FILE)

    template_files = sorted(os.listdir(TEMPLATES_DIR))
    if not template_files:
        fail(f'no template files found in {os.path.relpath(TEMPLATES_DIR, REPO_ROOT)}')

    for file in template_files:
        # Init placeholder: variableName -> {{VARIABLE_NAME}}
        placeholder = '{{%s}}' % screaming_snake_to_camel(os.path.splitext(file)[0])

        if placeholder not in script:
            fail(f'placeholder {placeholder} from template {file} not found in {os.path.relpath(USERSCRIPT_FILE, REPO_ROOT)}')

        # Get and minify content where possible
        content = read_file(os.path.join(TEMPLATES_DIR, file))
        if file.endswith('.js'):
            content = minify_js_html_template(content)
        elif file.endswith('.css'):
            content = minify_css(content)
        elif file == 'version':
            content = content.strip()

        # Replace placeholder with content
        script = script.replace(placeholder, content)

    # Inline the shared tradability helpers (tested via node, shipped inline so
    # dist stays single-file). Inserted raw: never minified, DEBUG markers kept
    # so the release/debug split below applies to them as well.
    if TRADABLE_LIB_PLACEHOLDER not in script:
        fail(f'placeholder {TRADABLE_LIB_PLACEHOLDER} from {os.path.relpath(TRADABLE_LIB_FILE, REPO_ROOT)} not found in {os.path.relpath(USERSCRIPT_FILE, REPO_ROOT)}')
    script = script.replace(TRADABLE_LIB_PLACEHOLDER, read_file(TRADABLE_LIB_FILE))

    leftovers = sorted(set(re.findall(r'{{[A-Za-z0-9_.]+}}', script)))
    if leftovers:
        fail(f'unreplaced placeholders in {os.path.relpath(USERSCRIPT_FILE, REPO_ROOT)}: {", ".join(leftovers)}')

    with open(DEBUG_FILE, 'w', encoding='utf8', newline='\n') as f:
        f.write(script.replace('  // DEBUG', ''))

    with open(RELEASE_FILE, 'w', encoding='utf8', newline='\n') as f:
        release_script = '\n'.join([x for x in script.split('\n') if not x.endswith('// DEBUG')])
        f.write(release_script)

    for path in (DEBUG_FILE, RELEASE_FILE):
        if not os.path.isfile(path) or os.path.getsize(path) == 0:
            fail(f'expected output was not written: {os.path.relpath(path, REPO_ROOT)}')

    print(f'built {os.path.relpath(DEBUG_FILE, REPO_ROOT)} and {os.path.relpath(RELEASE_FILE, REPO_ROOT)}')

if __name__ == '__main__':
    main()
