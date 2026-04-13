require 'spaceship'

# Authenticate with API Key
api_key = Spaceship::ConnectAPI::Token.from_json_file("./fastlane/asc_api_key.json")
Spaceship::ConnectAPI.token = api_key

# Find the app
app = Spaceship::ConnectAPI::App.find("com.donow.app")
puts "Found app: #{app.name}"

# Get internal group
groups = app.get_beta_groups
internal_group = groups.find { |g| g.name == "Internal Testers" }
puts "Found group: #{internal_group.name}"
puts "Has access to all builds: #{internal_group.has_access_to_all_builds}"

# Get all beta testers and check if Tony is in the group
all_testers = Spaceship::ConnectAPI::BetaTester.all
tester = all_testers.find { |t| t.email == "horingsng@hotmail.com" }

if tester
  puts "Found tester: #{tester.email}"
  
  # Try to get groups for this tester
  tester_groups = tester.get_beta_groups rescue []
  puts "Tester's groups: #{tester_groups.map(&:name).join(', ')}"
  
  # Check if in internal group
  in_internal = tester_groups.any? { |g| g.id == internal_group.id }
  puts "In Internal Testers: #{in_internal}"
  
  # Try to add using the tester's method
  if !in_internal
    begin
      # Use the group's add method with tester_id
      body = {
        data: [
          {
            type: "betaTesters",
            id: tester.id
          }
        ]
      }
      
      # Use the test_flight_request_client
      client = Spaceship::ConnectAPI.client.test_flight_request_client
      url = "/betaGroups/#{internal_group.id}/relationships/betaTesters"
      
      puts "POST #{url}"
      puts body.to_json
      
      response = client.request(:post, url, body)
      puts "Success! Added tester to group"
    rescue => e
      puts "Error: #{e.message}"
      puts e.backtrace.first(5).join("\n")
    end
  else
    puts "Tester already in group!"
  end
end

puts "\nNote: Internal groups with 'access to all builds' should automatically include new builds."
puts "The tester may need to wait for the build to be processed or refresh App Store Connect."