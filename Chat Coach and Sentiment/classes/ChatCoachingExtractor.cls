/**
* @File Name : ChatCoachingExtractor.cls
* @Description : Extracts agent performance rating and evaluation from chat coaching analysis output
* @Author :
* @Last Modified By :
* @Last Modified On : December 30, 2024
* @Modification Log :
*==============================================================================
* Ver | Date | Author | Modification
*==============================================================================
* 1.0 | December 30, 2024 |   | Initial Version - Chat coaching extractor for MessagingSession
**/

public class ChatCoachingExtractor {
    public class ExtractionResult {
        @InvocableVariable(label='Performance Rating' description='Extracted Agent Performance Rating (0-10)')
        public Integer PerformanceRating;

        @InvocableVariable(label='Performance Evaluation' description='The detailed evaluation and coaching feedback')
        public String PerformanceEvaluation;
    }

    @InvocableMethod(label='Extract Chat Coaching' description='Extracts Performance Rating and the remaining text as Evaluation from coaching analysis output')
    public static List<ExtractionResult> extractPerformanceAndEvaluation(List<String> inputs) {
        List<ExtractionResult> results = new List<ExtractionResult>();

        for (String coachingOutput : inputs) {
            ExtractionResult result = new ExtractionResult();

            // Extract Performance Rating
            String ratingHeader = 'Rating Score:';
            Integer startIndex = coachingOutput.toLowerCase().indexOf(ratingHeader.toLowerCase());
            if (startIndex != -1) {
                startIndex += ratingHeader.length();
                Integer endIndex = coachingOutput.indexOf('\n', startIndex); // Find the end of the line
                if (endIndex == -1) {
                    endIndex = coachingOutput.length();
                }
                String ratingString = coachingOutput.substring(startIndex, endIndex).trim();
                try {
                    result.PerformanceRating = Integer.valueOf(ratingString);
                } catch (Exception e) {
                    result.PerformanceRating = null; // If conversion fails, set to null
                }

                // Extract everything before the rating as Performance Evaluation
                Integer ratingStartIndex = coachingOutput.toLowerCase().indexOf(ratingHeader.toLowerCase());
                if (ratingStartIndex > 0) {
                    result.PerformanceEvaluation = coachingOutput.substring(0, ratingStartIndex).trim();
                } else {
                    result.PerformanceEvaluation = coachingOutput.trim(); // If rating is at the beginning, use whole thing
                }
            } else {
                result.PerformanceRating = null;
                result.PerformanceEvaluation = coachingOutput.trim(); // If no rating header, the whole thing is evaluation
            }

            results.add(result);
        }
        return results;
    }
}
