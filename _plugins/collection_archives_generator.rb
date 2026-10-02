# frozen_string_literal: true

module Jekyll
  module CollectionArchives
    class ArchivePage < Jekyll::PageWithoutAFile
      def initialize(site, directory, data)
        super(site, site.source, directory, "index.html")

        self.content = ""
        self.data = data
      end
    end

    class Generator < Jekyll::Generator
      safe false
      priority :low

      def generate(site)
        config = site.config.fetch("collection_archives", {})

        documents = []

        # Pages
        documents.concat(site.pages)

        # Posts
        documents.concat(site.posts.docs) if site.respond_to?(:posts)

        # All output collections
        site.collections.each_value do |collection|
          next unless collection.metadata["output"]

          documents.concat(collection.docs)
        end

        Jekyll.logger.info(
          "Collection archives",
          "Found #{documents.length} taggable documents"
        )
        generate_tag_archives(site, documents, config)
      end

      private

      def generate_tag_archives(site, documents, config)
        tag_directory = config.fetch("tag_directory", "tags")
        archive_layout = config.fetch("archive_layout", "archive")
        index_layout = config.fetch("index_layout", "page")

        tags = collect_values(documents, "tags")

        generate_tag_index(
          site,
          tags,
          tag_directory,
          index_layout
        )

        tags.each do |tag_name, tagged_documents|
          slug = Jekyll::Utils.slugify(tag_name, mode: "default")
          directory = File.join(tag_directory, slug)

          page = ArchivePage.new(
            site,
            directory,
            {
              "layout" => archive_layout,
              "title" => "Tag: #{tag_name}",
              "archive_type" => "tag",
              "archive_name" => tag_name,
              "tag" => tag_name,
              "documents" => sort_documents(tagged_documents),
              "permalink" => "/#{directory}/",
              "sitemap" => true,
              "parent" => [
                {
                  "link" => "/tags",
                  "title" => "Tags"
                }
              ]
            }
          )

          site.pages << page
        end
        
        Jekyll.logger.info(
          "Collection archives",
          "Generated #{tags.length} tag archives"
        )
      end

      def generate_tag_index(site, tags, tag_directory, layout)
        archives = tags.map do |tag_name, documents|
          slug = Jekyll::Utils.slugify(tag_name, mode: "default")

          {
            "name" => tag_name,
            "slug" => slug,
            "url" => "/#{tag_directory}/#{slug}/",
            "count" => documents.length
          }
        end

        archives.sort_by! { |archive| archive["name"].downcase }

        page = ArchivePage.new(
          site,
          tag_directory,
          {
            "layout" => layout,
            "title" => "Tags",
            "archives" => archives,
            "permalink" => "/#{tag_directory}/",
            "sitemap" => true
          }
        )

        site.pages << page
      end

      def collect_values(documents, field)
        values = Hash.new { |hash, key| hash[key] = [] }

        documents.each do |document|
          Array(document.data[field]).each do |value|
            name = value.to_s.strip.downcase
            next if name.empty?

            values[name] << document unless values[name].include?(document)
          end
        end

        values
      end

      def sort_documents(documents)
        documents.sort_by do |document|
          document.data["date"] || Time.at(0)
        end.reverse
      end
    end
  end
end