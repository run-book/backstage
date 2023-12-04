This is a CLI tool that is being used to experiment with Spotify's backstage

It can scan a pom.xml file and generate a backstage catalog for it. Currently it only
supports a pom.xml that has modules. It will generate a catalog for each module and a 
catalog for the parent project.

It also finds child 'extra' files in the form of 'backstage.xxx.yaml' and adds them to the parent catalog.

This is a work in progress and will probably be replaced by a backstage plugin. However this is great for
finding the requirements.

# adding info to pom.xml

We can add properties to the pom.xml file that will be used to generate the catalog-info.yaml file.

Currently the three most common properties are:

```xml
<properties>
    <backstage.kind>API</backstage.kind>
    <backstage.ignore>true</backstage.ignore>
    <backstage.spec><type>Service</type></backstage.spec>
</properties>
```
The first controls which template is used. If not found it uses the default template.

The second controls whether the module is ignored. This is typically used in modules that are just tests or not published

The third controls the type. It should probably be `library` or `service`  but others are possible

# Examples of use

A pom already contains a lot of information about a project. We can use this information to
make a catalog-info.yaml file for backstage.

For example the description, the dependencies... etc

Currently the git repo is scanned for the scm info, rather than the pom. This is likely to change and become
a change of responsibility


# installation 

```sh
npm install -g @runbook/backstage
```

# Example usages

```sh
backstage --help
backstage catalog make --name Rest2 --owner phil-rice -l production
```


