{% set section = get_section(path="blog/_index.md") %}
{% set index = [] %}
{% for page in section.pages %}
  {% set doc = {} %}
  {% set_global doc = doc | merge(id=loop.index | string) %}
  {% set_global doc = doc | merge(title=page.title) %}
  {% set_global doc = doc | merge(content=page.content | striptags) %}
  {% set_global doc = doc | merge(extra=page.extra) %}
  {% set_global index = index | push(value=doc) %}
{% endfor %}
{{ elasticlunr_index(docs=index, fields=["title", "content", "permalink"]) }}
