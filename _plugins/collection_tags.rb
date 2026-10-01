module Jekyll
  module CollectionTags
    def tags
      super.tap do |tags|
        collections.each_value do |collection|
          next unless collection.metadata["output"]

          collection.docs.each do |document|
            Array(document.data["tags"]).each do |tag|
              tags[tag] << document unless tags[tag].include?(document)
            end
          end
        end
      end
    end

  Site.prepend(CollectionTags)
  end
end