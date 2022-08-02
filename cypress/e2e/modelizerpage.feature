Feature: Test modelizer page

Scenario: Default modelizer page should be the model
  Given I clear localstorage
  And I set in localstorage field "projects" with '{"project-0001":{"id":"project-0001"}}' as "json"
  And I visit the "/#/modelizer/project-0001/"
  Then I expect current url is "/project-0001/model"

Scenario Outline: Modelizer "<page>" page should load the correct content
  Given I clear localstorage
  And I set in localstorage field "projects" with '{"project-0001":{"id":"project-0001"}}' as "json"
  And I visit the "/#/modelizer/project-0001/<page>"

  Then I expect "[data-cy=\"modelizer-switch\"] [aria-pressed=\"true\"] [class=\"block\"]" is "<switchText>"
  And  I expect "[data-cy=\"modelizer-<page>-view\"]" is "<pageContent>"

Examples:
  | page  | switchText | pageContent        |
  | model | Model      | ModelizerModelView |
  | text  | Text       | ModelizerTextView  |

Scenario: Clicking on switch should change page content
  Given I clear localstorage
  And I set in localstorage field "projects" with '{"project-0001":{"id":"project-0001"}}' as "json"
  And I visit the "/#/modelizer/project-0001/model"

  When I click on "[data-cy=\"modelizer-switch\"] [aria-pressed=\"false\"]"
  Then I expect "[data-cy=\"modelizer-switch\"] [aria-pressed=\"true\"] [class=\"block\"]" is "Text"
  And  I expect "[data-cy=\"modelizer-text-view\"]" is "ModelizerTextView"
  And I expect current url is "/project-0001/text"

  When I click on "[data-cy=\"modelizer-switch\"] [aria-pressed=\"false\"]"
  Then I expect "[data-cy=\"modelizer-switch\"] [aria-pressed=\"true\"] [class=\"block\"]" is "Model"
  And  I expect "[data-cy=\"modelizer-model-view\"]" is "ModelizerModelView"
  And I expect current url is "/project-0001/model"

Scenario: Clicking on application logo should redirect to homepage
  Given I clear localstorage
  And I set in localstorage field "projects" with '{"project-0001":{"id":"project-0001"}}' as "json"
  And I visit the "/#/modelizer/project-0001/"

  Then I expect current url is "/#/modelizer/project-0001/model"

  When I click on "[data-cy=\"app-logo-link\"]"
  Then I expect current url is "/"